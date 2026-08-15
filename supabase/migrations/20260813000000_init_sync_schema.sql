-- KeyTopia sync schema (docs/two-worlds-plan.md §8).
-- Target: Supabase (Postgres + RLS). The app stays local-first; these tables
-- are the sync target behind src/lib/sync.ts. Section shapes mirror
-- ProfileData in src/lib/types.ts; the column mapping lives in
-- src/lib/syncSupabase.ts, and the merge rules in src/lib/merge.ts run
-- client-side — the server stores, the client reconciles.
--
-- To apply: Supabase dashboard -> SQL Editor -> paste -> Run.
-- Safe to re-run: every statement is idempotent.

-- One row per learner profile. `owner` is the Supabase auth user — the
-- household grown-up, who may own several profiles (kids + adults). Children
-- never have an account of their own. The default means the client never has
-- to send it, and RLS means it cannot lie about it.
create table if not exists profiles (
  id          text primary key,              -- client-generated profile id
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile     jsonb not null,                -- Profile (name, avatar, ageGroup, layout, …)
  settings    jsonb not null default '{}',   -- Settings (LWW by touched.settings)
  key_stats   jsonb not null default '{}',   -- Record<key, KeyStat> (LWW)
  missions    jsonb not null default '{}',   -- weekly missions (LWW)
  misc        jsonb not null default '{}',   -- everything with no table and no special rule
  xp          integer not null default 0,    -- merge: max
  days        jsonb not null default '{}',   -- dayKey -> minutes (merge: per-day max)
  touched     jsonb not null default '{}',   -- per-section stamps (merge: per-key max)
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_by_owner on profiles (owner);

-- Append-only practice history. Upserts are idempotent on (profile_id, id),
-- which makes SyncAdapter.pushChanges safe to retry.
create table if not exists sessions (
  profile_id  text not null references profiles (id) on delete cascade,
  id          text not null,                 -- client-generated session id
  ended_at    timestamptz not null,
  mode        text not null,
  result      jsonb not null,                -- full SessionResult (timeline trimmed client-side)
  primary key (profile_id, id)
);
create index if not exists sessions_by_time on sessions (profile_id, ended_at desc);

-- One row per lesson per profile. Merge: max stars, then max wpm.
create table if not exists lesson_progress (
  profile_id  text not null references profiles (id) on delete cascade,
  lesson_id   text not null,                 -- 'b1', 't4', 'f2', future 'w6-…'
  stars       smallint not null check (stars between 0 and 3),
  wpm         real not null default 0,
  acc         real not null default 0,
  earned_at   timestamptz not null,
  primary key (profile_id, lesson_id)
);

-- Set-union collections.
create table if not exists badges (
  profile_id  text not null references profiles (id) on delete cascade,
  badge_id    text not null,
  unlocked_at timestamptz not null,          -- merge: earliest wins
  primary key (profile_id, badge_id)
);

create table if not exists records (
  profile_id  text not null references profiles (id) on delete cascade,
  key         text not null,                 -- 'wpm', 'acc', 'sprint60', …
  value       real not null,                 -- merge: max wins
  set_at      timestamptz not null,
  primary key (profile_id, key)
);

-- ---- Row-level security: a user touches only their own profiles ----
-- This is the whole security model. The browser holds a publishable key that
-- anyone can read out of the bundle, so these policies — not the key — are
-- what stop one household reading another's data.
alter table profiles        enable row level security;
alter table sessions        enable row level security;
alter table lesson_progress enable row level security;
alter table badges          enable row level security;
alter table records         enable row level security;

drop policy if exists "own profiles" on profiles;
create policy "own profiles" on profiles
  for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- Child tables inherit ownership through their parent profile row.
drop policy if exists "own sessions" on sessions;
create policy "own sessions" on sessions
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()));

drop policy if exists "own lesson_progress" on lesson_progress;
create policy "own lesson_progress" on lesson_progress
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()));

drop policy if exists "own badges" on badges;
create policy "own badges" on badges
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()));

drop policy if exists "own records" on records;
create policy "own records" on records
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()))
  with check (exists (select 1 from profiles p where p.id = profile_id and p.owner = auth.uid()));

-- ---- Table privileges ----
-- Two independent gates, and both must be open. RLS decides WHICH ROWS a signed-in
-- user may touch; these grants decide whether the role may address the table at
-- all. Without them every request fails with "permission denied for table
-- profiles" while the policies above look perfectly correct — Postgres never
-- gets far enough to evaluate them.
--
-- `anon` is deliberately granted nothing: signed-out visitors never sync.
grant select, insert, update, delete
  on table profiles, sessions, lesson_progress, badges, records
  to authenticated;
