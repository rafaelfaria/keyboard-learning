-- KeyTopia Classroom (docs/classrooms-plan.md §2–5).
--
-- A class is a *reader and meeting place* for data the sync layer already
-- moves: the teacher dashboard is a SELECT over lesson_progress + day_minutes,
-- never a second write path. Class state is shared state, not profile state —
-- it does not ride ProfileData.touched/collectChangeset (plan §4).
--
-- Safety model (plan §5), enforced here rather than in the client:
--   * students never see join codes, claim codes or teacher notes
--     (classes has no member SELECT policy; peers read the class_roster view);
--   * teacher visibility is a read-only policy extension over exactly two
--     tables (lesson_progress, day_minutes) — not profiles (settings/key_stats
--     jsonb), not sessions (timelines/keyAgg). Deleting a class_members row
--     severs the whole read path instantly;
--   * joining is a SECURITY DEFINER RPC: code-validated, rate-limited, capped.

-- ---------------------------------------------------------------------------
-- day_minutes: practice minutes split out of the profiles jsonb (plan §4).
-- One row per (profile, day) makes the teacher's minutes read a clean policy
-- instead of a jsonb carve-out. Merge rule stays per-day max (merge.ts).
-- ---------------------------------------------------------------------------

create table if not exists day_minutes (
  profile_id  text not null references profiles (id) on delete cascade,
  day         text not null check (day ~ '^\d{4}-\d{2}-\d{2}$'),  -- dayKey, metrics.ts
  minutes     real not null default 0 check (minutes >= 0 and minutes <= 1440),
  primary key (profile_id, day)
);

-- Backfill from the jsonb column, then drop it. Values are client-written
-- numbers; the regex guards the cast against any historical junk.
insert into day_minutes (profile_id, day, minutes)
select p.id, e.key, least(1440, greatest(0, e.value::real))
from profiles p, jsonb_each_text(p.days) e
where jsonb_typeof(p.days) = 'object'
  and e.key ~ '^\d{4}-\d{2}-\d{2}$'
  and e.value ~ '^-?\d+(\.\d+)?([eE][-+]?\d+)?$'
on conflict (profile_id, day) do update set minutes = greatest(day_minutes.minutes, excluded.minutes);

alter table profiles drop column if exists days;

alter table day_minutes enable row level security;

drop policy if exists "own day_minutes" on day_minutes;
create policy "own day_minutes" on day_minutes
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()));

-- ---------------------------------------------------------------------------
-- Join/claim codes. TYP-### theatre had 900 combos; real codes need entropy:
-- 6 chars from an unambiguous alphabet (no I/L/O/0/1) = 31^6 ≈ 887M (plan §3).
-- ---------------------------------------------------------------------------

create or replace function gen_join_code() returns text
language sql volatile
set search_path = public, pg_temp
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 31) + 1)::int, 1), '')
  from generate_series(1, 6)
$$;

-- ---------------------------------------------------------------------------
-- classes / class_members / assignments / class_daily_scores (plan §4)
-- ---------------------------------------------------------------------------

create table if not exists classes (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  join_code   text not null unique default gen_join_code(),
  settings    jsonb not null default '{}',   -- { hideBoard?: boolean }
  created_at  timestamptz not null default now()
);
create index if not exists classes_by_owner on classes (owner);

-- One row per seat. Two ways a seat comes to exist:
--   * join-by-code: profile_id set immediately (join_class RPC);
--   * teacher-managed roster: profile_id null + claim_code set — the kid
--     enters the one-time code and the slot binds to their device's anonymous
--     account (claim_slot RPC). This is the "school accounts, no kid emails"
--     promise from the Family page.
-- display_name is what peers see: picker-generated safe names only, never a
-- real full name. A real first name may live in teacher_note, which no student
-- can ever select (it is excluded from the class_roster view).
create table if not exists class_members (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references classes (id) on delete cascade,
  profile_id    text references profiles (id) on delete cascade,
  display_name  text not null check (display_name ~ '^[A-Za-z0-9 ]{1,24}$'),
  teacher_note  text check (teacher_note is null or char_length(teacher_note) <= 80),
  role          text not null default 'student',
  claim_code    text unique,
  joined_at     timestamptz not null default now(),
  unique (class_id, profile_id)
);
create index if not exists class_members_by_class on class_members (class_id);
create index if not exists class_members_by_profile on class_members (profile_id);

create table if not exists assignments (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references classes (id) on delete cascade,
  kind        text not null check (kind in ('lesson', 'minutes', 'world')),
  target      jsonb not null check (
    (kind = 'lesson'  and jsonb_typeof(target -> 'lessonIds') = 'array')
    or (kind = 'minutes' and jsonb_typeof(target -> 'minutes') = 'number')
    or (kind = 'world'   and jsonb_typeof(target -> 'worldId') = 'string')
  ),
  note        text check (note is null or char_length(note) <= 200),
  due_at      timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists assignments_by_class on assignments (class_id);

-- One best-score row per (class, member, day), mirroring the local
-- data.daily[dayKey] upsert in Challenge.tsx. Bounds are the "classroom, not
-- open ladder" trust model (plan §2.5). `hidden` carries the student's
-- hideLeaderboards choice at submit time: withheld from peers, still visible
-- to the class owner.
--
-- `score` is a generated column (same approach as daily_scores in the
-- 20260814120000 migration): the client may only state wpm/acc/rhythm, all
-- CHECK-clamped to human ranges, so a row can never carry a score unrelated to
-- its own inputs. Mirrors scoreFor() in src/lib/challenge.ts — if that formula
-- changes, both migrations need a follow-up together.
create or replace function class_score(p_mode text, p_wpm real, p_acc real, p_rhythm real)
returns integer
language sql immutable
as $$
  select (case p_mode
    when 'accuracy' then round(p_acc * 10 + least(p_wpm, 40))
    when 'rhythm'   then round(p_rhythm * 8 + p_wpm + p_acc)
    else                 round((case when p_acc < 92 then p_wpm * 0.6 else p_wpm end) * 10 + p_acc)
  end)::integer
$$;

create table if not exists class_daily_scores (
  class_id      uuid not null references classes (id) on delete cascade,
  profile_id    text not null references profiles (id) on delete cascade,
  day           text not null check (day ~ '^\d{4}-\d{2}-\d{2}$'),
  mode          text not null check (mode in ('speed', 'accuracy', 'rhythm')),
  wpm           real not null check (wpm >= 0 and wpm <= 260),
  acc           real not null check (acc >= 0 and acc <= 100),
  rhythm        real not null default 0 check (rhythm >= 0 and rhythm <= 100),
  score         integer not null generated always as (class_score(mode, wpm, acc, rhythm)) stored,
  hidden        boolean not null default false,
  submitted_at  timestamptz not null default now(),
  primary key (class_id, profile_id, day)
);

-- The day's BEST run wins, enforced server-side so the client upsert can stay
-- dumb: a later, slower run never clobbers the morning's record. `hidden` is
-- deliberately left out — a changed hideLeaderboards setting must always take
-- effect on resubmit, even when the run itself was worse.
create or replace function keep_best_class_score() returns trigger
language plpgsql
as $$
begin
  if class_score(new.mode, new.wpm, new.acc, new.rhythm)
     < class_score(old.mode, old.wpm, old.acc, old.rhythm) then
    new.mode := old.mode; new.wpm := old.wpm; new.acc := old.acc; new.rhythm := old.rhythm;
    new.submitted_at := old.submitted_at;
  end if;
  return new;
end $$;

drop trigger if exists class_daily_scores_keep_best on class_daily_scores;
create trigger class_daily_scores_keep_best
  before update on class_daily_scores
  for each row execute function keep_best_class_score();

-- Rate-limit ledger for join_class/claim_slot. No grants, no policies: only
-- the SECURITY DEFINER functions below ever touch it.
create table if not exists join_attempts (
  uid           uuid not null,
  attempted_at  timestamptz not null default now()
);
create index if not exists join_attempts_by_uid on join_attempts (uid, attempted_at);
alter table join_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table classes enable row level security;
alter table class_members enable row level security;
alter table assignments enable row level security;
alter table class_daily_scores enable row level security;

-- classes: owner everything. Deliberately NO member select policy — join_code
-- lives on this row and must never be selectable by students (plan §4).
-- Members read class name/settings through the my_classes view instead.
drop policy if exists "owner manages classes" on classes;
create policy "owner manages classes" on classes
  for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- Anonymous sign-ins are on (kid class-join), and an anonymous session IS
-- `authenticated` — so "authenticated" no longer implies "a household that
-- signed up". Owning a class is the teacher surface: it must require a real
-- account. RESTRICTIVE, so it ANDs with the policy above instead of ORing.
drop policy if exists "classes need a real account" on classes;
create policy "classes need a real account" on classes
  as restrictive for insert to authenticated
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

-- class_members: the class owner manages every seat; a member sees and may
-- delete (leave) their own row. Students never insert rows directly — joining
-- goes through the definer RPCs, which is where codes, caps and rate limits
-- are checked.
drop policy if exists "owner manages members" on class_members;
create policy "owner manages members" on class_members
  for all to authenticated
  using (exists (select 1 from classes c where c.id = class_id and c.owner = auth.uid()))
  with check (exists (select 1 from classes c where c.id = class_id and c.owner = auth.uid()));

drop policy if exists "member reads own seat" on class_members;
create policy "member reads own seat" on class_members
  for select to authenticated
  using (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()));

drop policy if exists "member leaves" on class_members;
create policy "member leaves" on class_members
  for delete to authenticated
  using (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()));

-- assignments: owner writes, members read.
drop policy if exists "owner manages assignments" on assignments;
create policy "owner manages assignments" on assignments
  for all to authenticated
  using (exists (select 1 from classes c where c.id = class_id and c.owner = auth.uid()))
  with check (exists (select 1 from classes c where c.id = class_id and c.owner = auth.uid()));

drop policy if exists "members read assignments" on assignments;
create policy "members read assignments" on assignments
  for select to authenticated
  using (exists (
    select 1 from class_members cm join profiles p on p.id = cm.profile_id
    where cm.class_id = assignments.class_id and p.owner = auth.uid()
  ));

-- class_daily_scores: you write your own (and only while you are a member of
-- that class); the owner reads everything; classmates read non-hidden rows,
-- and only while the class board is not switched off.
drop policy if exists "own scores" on class_daily_scores;
create policy "own scores" on class_daily_scores
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()))
  with check (
    exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid())
    and exists (select 1 from class_members cm
                where cm.class_id = class_daily_scores.class_id
                  and cm.profile_id = class_daily_scores.profile_id)
  );

drop policy if exists "owner reads scores" on class_daily_scores;
create policy "owner reads scores" on class_daily_scores
  for select to authenticated
  using (exists (select 1 from classes c where c.id = class_id and c.owner = auth.uid()));

-- Policies execute their subqueries AS THE REQUESTER, and peers have no read
-- on classes at all — an inline `select settings from classes` would see
-- nothing, return NULL, and quietly disable the hideBoard gate. The definer
-- helper reads past RLS for this one yes/no question and nothing else.
create or replace function class_board_hidden(p_class_id uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((c.settings ->> 'hideBoard')::boolean, false)
  from classes c where c.id = p_class_id
$$;

drop policy if exists "classmates read visible scores" on class_daily_scores;
create policy "classmates read visible scores" on class_daily_scores
  for select to authenticated
  using (
    not hidden
    and exists (
      select 1 from class_members cm join profiles p on p.id = cm.profile_id
      where cm.class_id = class_daily_scores.class_id and p.owner = auth.uid()
    )
    and not coalesce(class_board_hidden(class_id), false)
  );

-- Teacher visibility: a read-only policy extension, not a widening of
-- ownership (plan §4). Exactly these two tables; nothing else.
drop policy if exists "class owner reads member lessons" on lesson_progress;
create policy "class owner reads member lessons" on lesson_progress
  for select to authenticated
  using (exists (
    select 1 from class_members cm join classes c on c.id = cm.class_id
    where cm.profile_id = lesson_progress.profile_id and c.owner = auth.uid()
  ));

drop policy if exists "class owner reads member minutes" on day_minutes;
create policy "class owner reads member minutes" on day_minutes
  for select to authenticated
  using (exists (
    select 1 from class_members cm join classes c on c.id = cm.class_id
    where cm.profile_id = day_minutes.profile_id and c.owner = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Views. Both are deliberately SECURITY DEFINER (the Postgres default for
-- views): they run as the table owner so they can read past RLS, and the WHERE
-- clause is the entire access rule. That is the point — they expose a *subset*
-- of columns (no teacher_note, no claim_code, no join_code) to a *wider*
-- audience (fellow members) than the base-table policies ever allow.
-- ---------------------------------------------------------------------------

-- What a student may know about their classmates: safe display names only.
create or replace view class_roster as
select cm.class_id, cm.id as member_id, cm.profile_id, cm.display_name, cm.role, cm.joined_at
from class_members cm
where cm.profile_id is not null
  and exists (
    select 1 from class_members me join profiles p on p.id = me.profile_id
    where me.class_id = cm.class_id and p.owner = auth.uid()
  );

-- The classes my profiles belong to: name and settings, never the join code.
create or replace view my_classes as
select c.id as class_id, c.name, c.settings, c.created_at,
       cm.id as member_id, cm.profile_id, cm.display_name, cm.joined_at
from classes c
join class_members cm on cm.class_id = c.id
where exists (select 1 from profiles p where p.id = cm.profile_id and p.owner = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs. SECURITY DEFINER so an anonymous kid account can create exactly one
-- membership row through a validated, rate-limited, capped door — while the
-- base table stays closed to student writes.
-- ---------------------------------------------------------------------------

-- 40 seats: a class, not a ladder (plan's member cap).
create or replace function class_seat_limit() returns int
language sql immutable as $$ select 40 $$;

-- Shared throttle: 20 code attempts per account per hour. Returns true when the
-- caller is over the limit. Callers must REPORT failures with a status row, not
-- `raise` — an exception would roll the transaction back, taking the attempt
-- row with it, and a rate limiter whose failed attempts never persist is
-- decoration, not a limiter.
create or replace function note_join_attempt() returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from join_attempts where attempted_at < now() - interval '2 hours';
  insert into join_attempts (uid) values (auth.uid());
  return (select count(*) from join_attempts
          where uid = auth.uid() and attempted_at > now() - interval '1 hour') > 20;
end $$;

-- status: 'ok' | 'rate_limited' | 'not_found' | 'full'. Genuine client bugs
-- (unowned profile, malformed name) still raise; guessable outcomes return, so
-- every attempt row commits and the throttle actually counts.
create or replace function join_class(p_code text, p_profile_id text, p_display_name text)
returns table (status text, class_id uuid, class_name text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
-- The OUT columns (class_id, …) share names with table columns; inside SQL
-- statements the column must win or ON CONFLICT targets turn ambiguous.
#variable_conflict use_column
declare
  c classes%rowtype;
  seat_count int;
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  dn text := trim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from profiles p where p.id = p_profile_id and p.owner = auth.uid()) then
    raise exception 'that explorer does not belong to this account';
  end if;
  if dn !~ '^[A-Za-z0-9 ]{1,24}$' then raise exception 'display name not allowed'; end if;

  if note_join_attempt() then
    return query select 'rate_limited'::text, null::uuid, null::text; return;
  end if;

  select * into c from classes where join_code = code;
  if not found then
    return query select 'not_found'::text, null::uuid, null::text; return;
  end if;

  select count(*) into seat_count from class_members cm where cm.class_id = c.id;
  if seat_count >= class_seat_limit()
     and not exists (select 1 from class_members cm where cm.class_id = c.id and cm.profile_id = p_profile_id) then
    return query select 'full'::text, null::uuid, null::text; return;
  end if;

  insert into class_members as cm (class_id, profile_id, display_name)
  values (c.id, p_profile_id, dn)
  on conflict (class_id, profile_id) do update set display_name = excluded.display_name;

  return query select 'ok'::text, c.id, c.name;
end $$;

-- status: 'ok' | 'rate_limited' | 'not_found' | 'already_member'.
create or replace function claim_slot(p_code text, p_profile_id text)
returns table (status text, class_id uuid, class_name text, display_name text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  slot class_members%rowtype;
  cname text;
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from profiles p where p.id = p_profile_id and p.owner = auth.uid()) then
    raise exception 'that explorer does not belong to this account';
  end if;

  if note_join_attempt() then
    return query select 'rate_limited'::text, null::uuid, null::text, null::text; return;
  end if;

  select * into slot from class_members cm where cm.claim_code = code and cm.profile_id is null;
  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text; return;
  end if;
  if exists (select 1 from class_members cm
             where cm.class_id = slot.class_id and cm.profile_id = p_profile_id) then
    return query select 'already_member'::text, null::uuid, null::text, null::text; return;
  end if;

  update class_members cm
  set profile_id = p_profile_id, claim_code = null, joined_at = now()
  where cm.id = slot.id;

  select c.name into cname from classes c where c.id = slot.class_id;
  return query select 'ok'::text, slot.class_id, cname, slot.display_name;
end $$;

-- Teacher pre-creates a named seat and gets a one-time claim code back.
create or replace function create_slot(p_class_id uuid, p_display_name text, p_teacher_note text default null)
returns table (member_id uuid, claim_code text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  seat_count int;
  code text := gen_join_code();
  dn text := trim(coalesce(p_display_name, ''));
begin
  if not exists (select 1 from classes c where c.id = p_class_id and c.owner = auth.uid()) then
    raise exception 'not your class';
  end if;
  if dn !~ '^[A-Za-z0-9 ]{1,24}$' then raise exception 'display name not allowed'; end if;
  select count(*) into seat_count from class_members cm where cm.class_id = p_class_id;
  if seat_count >= class_seat_limit() then raise exception 'class is full'; end if;

  return query
  insert into class_members as cm (class_id, display_name, teacher_note, claim_code)
  values (p_class_id, dn, nullif(trim(coalesce(p_teacher_note, '')), ''), code)
  returning cm.id, cm.claim_code;
end $$;

-- ---------------------------------------------------------------------------
-- Privileges. Two gates, both must be open (see the init migration): RLS
-- picks rows, these grants let the role address the object at all.
-- join_attempts gets no grant on purpose — definer functions only.
-- `anon` gets nothing: signed-out visitors have no classroom.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete
  on table classes, class_members, assignments, class_daily_scores, day_minutes
  to authenticated;

grant select on class_roster, my_classes to authenticated;

-- Postgres grants EXECUTE to PUBLIC on every new function, and PUBLIC includes
-- `anon` — so revoke first, then grant, or the grant changes nothing. This
-- matters more now that anonymous sign-ins are on: `authenticated` already
-- includes every kid device, and `anon` must stay fully outside.
revoke all on function gen_join_code() from public;
revoke all on function class_seat_limit() from public;
revoke all on function class_score(text, real, real, real) from public;
revoke all on function class_board_hidden(uuid) from public;
revoke all on function keep_best_class_score() from public;
revoke all on function note_join_attempt() from public;
revoke all on function join_class(text, text, text) from public;
revoke all on function claim_slot(text, text) from public;
revoke all on function create_slot(uuid, text, text) from public;

grant execute on function gen_join_code() to authenticated;         -- code rotation by owners
grant execute on function class_score(text, real, real, real) to authenticated;  -- backs the generated column
grant execute on function class_board_hidden(uuid) to authenticated; -- evaluated inside the peers policy
grant execute on function join_class(text, text, text) to authenticated;
grant execute on function claim_slot(text, text) to authenticated;
grant execute on function create_slot(uuid, text, text) to authenticated;
