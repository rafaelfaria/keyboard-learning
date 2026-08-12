-- KeyTopia sync schema draft (docs/two-worlds-plan.md §8, item 4).
-- Target: Supabase (Postgres + RLS). The app stays local-first; these tables
-- are the sync target behind src/lib/sync.ts. Section shapes mirror
-- ProfileData in src/lib/types.ts; merge rules live in src/lib/merge.ts and
-- run client-side — the server stores, the client reconciles.
--
-- To apply: create a Supabase project, paste this into the SQL editor, run.

-- One row per learner profile. `owner` is the Supabase auth user; a household
-- account can own several profiles (kids + grown-ups), matching the app.
create table profiles (
  id          text primary key,              -- client-generated profile id
  owner       uuid not null references auth.users (id) on delete cascade,
  profile     jsonb not null,                -- Profile (name, avatar, ageGroup, layout, …)
  settings    jsonb not null default '{}',   -- Settings (LWW by touched.settings)
  key_stats   jsonb not null default '{}',   -- Record<key, KeyStat> (LWW)
  missions    jsonb not null default '{}',   -- weekly missions (LWW)
  journey     jsonb not null default '{}',   -- cosmetics only; progress derives from lesson_progress
  xp          integer not null default 0,    -- merge: max
  days        jsonb not null default '{}',   -- dayKey -> minutes (merge: per-day max)
  touched     jsonb not null default '{}',   -- per-section stamps (merge: per-key max)
  updated_at  timestamptz not null default now()
);

-- Append-only practice history. Upserts are idempotent on (profile_id, id),
-- which makes SyncAdapter.pushChanges safe to retry.
create table sessions (
  profile_id  text not null references profiles (id) on delete cascade,
  id          text not null,                 -- client-generated session id
  ended_at    timestamptz not null,
  mode        text not null,
  result      jsonb not null,                -- full SessionResult (timeline trimmed client-side)
  primary key (profile_id, id)
);
create index sessions_by_time on sessions (profile_id, ended_at desc);

-- One row per lesson per profile. Merge: max stars, then max wpm.
create table lesson_progress (
  profile_id  text not null references profiles (id) on delete cascade,
  lesson_id   text not null,                 -- 'b1', 't4', 'f2', future 'w6-…'
  stars       smallint not null check (stars between 0 and 3),
  wpm         real not null default 0,
  acc         real not null default 0,
  earned_at   timestamptz not null,
  primary key (profile_id, lesson_id)
);

-- Set-union collections.
create table badges (
  profile_id  text not null references profiles (id) on delete cascade,
  badge_id    text not null,
  unlocked_at timestamptz not null,          -- merge: earliest wins
  primary key (profile_id, badge_id)
);

create table records (
  profile_id  text not null references profiles (id) on delete cascade,
  key         text not null,                 -- 'wpm', 'acc', 'sprint60', …
  value       real not null,                 -- merge: max wins
  set_at      timestamptz not null,
  primary key (profile_id, key)
);

-- ---- Row-level security: a user touches only their own profiles ----
alter table profiles enable row level security;
alter table sessions enable row level security;
alter table lesson_progress enable row level security;
alter table badges enable row level security;
alter table records enable row level security;

create policy "own profiles" on profiles
  for all using (owner = auth.uid()) with check (owner = auth.uid());

create policy "own sessions" on sessions
  for all using (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()));

create policy "own lesson_progress" on lesson_progress
  for all using (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()));

create policy "own badges" on badges
  for all using (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()));

create policy "own records" on records
  for all using (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()));
