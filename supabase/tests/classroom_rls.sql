-- KeyTopia Classroom — RLS verification (docs/classrooms-plan.md §6 item 8).
--
-- Run against the LOCAL stack (never production):
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54422/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/classroom_rls.sql
--
-- Everything runs inside one transaction and rolls back: the database is
-- untouched afterwards, so this never needs a db reset and can run while other
-- work is in flight. Identities are simulated the way PostgREST does it —
-- `set local role` + the request.jwt.claims GUC that auth.uid() reads.
--
-- Cast: T (teacher, owns the class) · K (kid, anonymous-style account, one
-- profile) · S (second household: one profile that joins by code, one that
-- claims a teacher-created slot). Every FAIL raises, so ON_ERROR_STOP makes
-- the exit code the verdict; the last line prints only if everything held.

begin;

create function pg_temp.assert(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAIL: %', msg; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Seed (as postgres): three accounts, three profiles, kid practice history
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'teacher@rls.test'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', null),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'household@rls.test');

insert into profiles (id, owner, profile) values
  ('kid-p',  '22222222-2222-2222-2222-222222222222', '{"name":"Leo"}'),
  ('str-p',  '33333333-3333-3333-3333-333333333333', '{"name":"Ana"}'),
  ('str-p2', '33333333-3333-3333-3333-333333333333', '{"name":"Rui"}');

insert into lesson_progress (profile_id, lesson_id, stars, wpm, acc, earned_at) values
  ('kid-p', 'b1', 3, 14, 96, now()), ('kid-p', 'b2', 2, 12, 94, now()), ('kid-p', 'h1', 1, 11, 92, now());

insert into day_minutes (profile_id, day, minutes) values
  ('kid-p', to_char(now(), 'YYYY-MM-DD'), 12), ('kid-p', to_char(now() - interval '1 day', 'YYYY-MM-DD'), 8);

insert into sessions (profile_id, id, ended_at, mode, result) values
  ('kid-p', 's1', now(), 'lesson', '{"wpm":14}');

-- Views must be structurally incapable of leaking the sensitive columns.
select pg_temp.assert(
  not exists (select 1 from information_schema.columns
              where table_name in ('class_roster', 'my_classes')
                and column_name in ('teacher_note', 'claim_code', 'join_code')),
  'roster/my_classes views expose no sensitive columns');
select pg_temp.assert(
  not exists (select 1 from information_schema.columns
              where table_name = 'profiles' and column_name = 'days'),
  'profiles.days is gone after the day_minutes split');

-- ---------------------------------------------------------------------------
-- T creates a class
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

insert into classes (name) values ('Class 5B') returning id as cid, join_code as ccode \gset

select pg_temp.assert(length(:'ccode') = 6, 'join code is 6 chars');
select pg_temp.assert((select count(*) from classes) = 1, 'teacher sees own class');
select pg_temp.assert((select join_code from classes where id = :'cid') = :'ccode', 'teacher may read the join code');

-- A second class for negative tests.
insert into classes (name) values ('Other Period') returning id as cid2 \gset

-- ---------------------------------------------------------------------------
-- K (kid) joins by code
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select pg_temp.assert((select count(*) from classes) = 0, 'kid cannot see the classes table at all (join_code protected)');
select pg_temp.assert(
  (select status from join_class('WRONG1', 'kid-p', 'BrightMaple07')) = 'not_found',
  'wrong code reports not_found');
-- Lowercase, dash-formatted entry must normalize.
select pg_temp.assert(
  (select status from join_class(lower(substr(:'ccode', 1, 3)) || '-' || lower(substr(:'ccode', 4, 3)), 'kid-p', 'BrightMaple07')) = 'ok',
  'kid joins with normalized code');

select pg_temp.assert((select count(*) from my_classes) = 1, 'kid sees the class through my_classes');
select pg_temp.assert((select count(*) from class_roster where class_id = :'cid') = 1, 'kid sees the roster (self)');
select pg_temp.assert((select count(*) from classes) = 0, 'membership still grants no read of the classes row');

do $$ begin
  perform * from join_class('ABC123', 'str-p', 'Nope01');
  raise exception 'FAIL: kid could attempt a join with someone else''s profile';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
end $$;

-- ---------------------------------------------------------------------------
-- S is a stranger: nothing is visible, nothing is writable
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select pg_temp.assert((select count(*) from class_roster) = 0, 'stranger sees no roster');
select pg_temp.assert((select count(*) from assignments) = 0, 'stranger sees no assignments');
select pg_temp.assert((select count(*) from lesson_progress where profile_id = 'kid-p') = 0, 'stranger cannot read kid lessons');
select pg_temp.assert((select count(*) from day_minutes where profile_id = 'kid-p') = 0, 'stranger cannot read kid minutes');

do $$ begin
  insert into class_members (class_id, profile_id, display_name)
  values ((select set_config('x.c', current_setting('x.c', true), true))::uuid, 'str-p', 'SneakyFox01');
  raise exception 'FAIL: unreachable';
exception when others then
  if sqlerrm like 'FAIL:%' then raise exception 'FAIL: stranger inserted a membership directly'; end if;
end $$;

with u as (update classes set name = 'HACKED' where id = :'cid' returning 1)
select pg_temp.assert((select count(*) from u) = 0, 'stranger cannot rename the class');

-- ---------------------------------------------------------------------------
-- T: the dashboard read path — and its deliberate limits
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select pg_temp.assert((select count(*) from lesson_progress where profile_id = 'kid-p') = 3, 'teacher reads member lesson progress');
select pg_temp.assert((select count(*) from day_minutes where profile_id = 'kid-p') = 2, 'teacher reads member minutes');
select pg_temp.assert((select count(*) from profiles where id = 'kid-p') = 0, 'teacher can NOT read the member profiles row');
select pg_temp.assert((select count(*) from sessions where profile_id = 'kid-p') = 0, 'teacher can NOT read member sessions');

insert into assignments (class_id, kind, target, note)
values (:'cid', 'lesson', '{"lessonIds":["h2"]}', 'Clear Meadow Isle spot 4 this week');

select claim_code as slotcode from create_slot(:'cid'::uuid, 'RiverFox11', 'Maya R.') \gset
select pg_temp.assert(length(:'slotcode') = 6, 'slot claim code is 6 chars');

do $$ begin
  perform * from create_slot(null, 'X', null);
  raise exception 'FAIL: unreachable';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
end $$;

-- ---------------------------------------------------------------------------
-- K: assignments arrive; scores submit with a server-computed best
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select pg_temp.assert((select count(*) from assignments where class_id = :'cid') = 1, 'member reads assignments');

insert into class_daily_scores (class_id, profile_id, day, mode, wpm, acc)
values (:'cid', 'kid-p', to_char(now(), 'YYYY-MM-DD'), 'speed', 30, 95);
select pg_temp.assert(
  (select score from class_daily_scores where profile_id = 'kid-p') = 395,
  'score is generated server-side (30 wpm · 95% -> 395)');

-- A worse afternoon run must not clobber the morning best.
insert into class_daily_scores (class_id, profile_id, day, mode, wpm, acc)
values (:'cid', 'kid-p', to_char(now(), 'YYYY-MM-DD'), 'speed', 20, 90)
on conflict (class_id, profile_id, day) do update
  set mode = excluded.mode, wpm = excluded.wpm, acc = excluded.acc,
      rhythm = excluded.rhythm, hidden = excluded.hidden, submitted_at = now();
select pg_temp.assert(
  (select score from class_daily_scores where profile_id = 'kid-p') = 395,
  'keep-best trigger holds the better run');

-- A better one does land.
insert into class_daily_scores (class_id, profile_id, day, mode, wpm, acc)
values (:'cid', 'kid-p', to_char(now(), 'YYYY-MM-DD'), 'speed', 40, 96)
on conflict (class_id, profile_id, day) do update
  set mode = excluded.mode, wpm = excluded.wpm, acc = excluded.acc,
      rhythm = excluded.rhythm, hidden = excluded.hidden, submitted_at = now();
select pg_temp.assert(
  (select score from class_daily_scores where profile_id = 'kid-p') = 496,
  'better run replaces the best (40 wpm · 96% -> 496)');

do $$ declare v_cid2 uuid; begin
  select id into v_cid2 from classes limit 1;  -- kid sees no classes; prove insert is blocked anyway
  begin
    insert into class_daily_scores (class_id, profile_id, day, mode, wpm, acc)
    select c.id, 'kid-p', to_char(now(), 'YYYY-MM-DD'), 'speed', 30, 95
    from (values (gen_random_uuid())) as c(id);
    raise exception 'FAIL: scored a class the kid is not a member of';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- S joins with one profile, claims a slot with another
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select pg_temp.assert((select status from join_class(:'ccode', 'str-p', 'CalmHarbor02')) = 'ok', 'second member joins');
select pg_temp.assert((select count(*) from class_roster where class_id = :'cid') = 2, 'roster shows both members, not the empty slot');
select pg_temp.assert(
  (select count(*) from class_daily_scores where profile_id = 'kid-p' and class_id = :'cid') = 1,
  'classmate sees the kid''s visible score');

select pg_temp.assert((select status from claim_slot('WRONG2', 'str-p2')) = 'not_found', 'bad claim code reports not_found');
select pg_temp.assert((select status from claim_slot(:'slotcode', 'str-p')) = 'already_member', 'claiming with an enrolled profile is refused');
select
  pg_temp.assert(r.status = 'ok' and r.display_name = 'RiverFox11', 'slot binds and keeps the teacher-chosen safe name')
from claim_slot(:'slotcode', 'str-p2') r;
select pg_temp.assert((select count(*) from class_roster where class_id = :'cid') = 3, 'claimed slot appears on the roster');

-- ---------------------------------------------------------------------------
-- hidden scores and hideBoard
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
update class_daily_scores set hidden = true where profile_id = 'kid-p';
select pg_temp.assert((select wpm from class_daily_scores where profile_id = 'kid-p') = 40, 'hiding does not touch the recorded run');

select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select pg_temp.assert(
  (select count(*) from class_daily_scores where profile_id = 'kid-p') = 0,
  'hidden score is invisible to classmates');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select pg_temp.assert(
  (select count(*) from class_daily_scores where profile_id = 'kid-p') = 1,
  'hidden score stays visible to the class owner');

-- Board off for the whole class: even visible rows disappear for peers.
update classes set settings = '{"hideBoard": true}' where id = :'cid';
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
update class_daily_scores set hidden = false where profile_id = 'kid-p';
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select pg_temp.assert(
  (select count(*) from class_daily_scores where profile_id = 'kid-p') = 0,
  'hideBoard blanks the board for peers');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select pg_temp.assert(
  (select count(*) from class_daily_scores where profile_id = 'kid-p') = 1,
  'hideBoard does not blind the teacher');
update classes set settings = '{}' where id = :'cid';

-- ---------------------------------------------------------------------------
-- Removing a member severs every read instantly
-- ---------------------------------------------------------------------------
delete from class_members where class_id = :'cid' and profile_id = 'kid-p';
select pg_temp.assert((select count(*) from lesson_progress where profile_id = 'kid-p') = 0, 'removal severs the lessons read');
select pg_temp.assert((select count(*) from day_minutes where profile_id = 'kid-p') = 0, 'removal severs the minutes read');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select pg_temp.assert((select count(*) from my_classes) = 0, 'removed kid no longer sees the class');

-- ---------------------------------------------------------------------------
-- Anonymous accounts are `authenticated`, but the teacher surface needs a
-- real sign-in: an is_anonymous JWT may join classes, never own one.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":true}', true);
do $$ begin
  insert into classes (name) values ('Sneaky Class');
  raise exception 'FAIL: anonymous account created a class';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
end $$;
select pg_temp.assert(
  (select status from join_class(:'ccode', 'kid-p', 'BrightMaple07')) = 'ok',
  'anonymous account can still join a class');
delete from class_members where profile_id = 'kid-p';  -- leave again (member delete policy)

-- ---------------------------------------------------------------------------
-- The rate limiter counts failed guesses
-- ---------------------------------------------------------------------------
do $$ declare i int; hits int := 0; st text; begin
  for i in 1..25 loop
    select status into st from join_class('GUESS' || (i % 9 + 1), 'kid-p', 'BrightMaple07');
    if st = 'rate_limited' then hits := hits + 1; end if;
  end loop;
  if hits = 0 then raise exception 'FAIL: 25 bad codes never tripped the rate limiter'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- anon: no classroom surface exists at all
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$ begin
  perform count(*) from classes;
  raise exception 'FAIL: anon can address the classes table';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform count(*) from class_roster;
  raise exception 'FAIL: anon can address the roster view';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform * from join_class('ABCDEF', 'kid-p', 'Nope01');
  raise exception 'FAIL: anon can execute join_class';
exception when insufficient_privilege then null;
end $$;

reset role;
rollback;

\echo ALL CLASSROOM RLS CHECKS PASSED
