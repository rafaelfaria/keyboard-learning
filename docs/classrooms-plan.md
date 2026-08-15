# KeyTopia Classroom — design plan

> **Status (2026-08-15): items 1–4 shipped — "Classroom core".** A teacher
> creates a class, students join by code with no email, and the dashboard reads
> real lesson stars and practice minutes. Items 5–7 ("Play together": real race
> rooms, co-op, async duels) are **not built** — every multiplayer surface in
> the app is still the labeled simulation described in §1.
>
> Shipped: `supabase/migrations/20260814121000_classrooms.sql`,
> `supabase/tests/classroom_rls.sql`, `src/lib/classroom.ts`,
> `src/pages/JoinClass.tsx`, `src/components/ClassCard.tsx`, a rebuilt
> `src/pages/Family.tsx`, and the `day_minutes` split in `src/lib/syncSupabase.ts`.
>
> Two deviations from §4 as written, both deliberate:
> `class_members` gained a surrogate `id` (unclaimed seats have no `profile_id`,
> so the composite key could not be the primary key), and `class_daily_scores`
> stores `mode`/`rhythm` with `score` as a generated column rather than a
> client-supplied integer — matching the sibling `daily_scores` table so a
> client cannot post a score unrelated to its own wpm/acc.

Classrooms turn KeyTopia's simulated community into a real one, for exactly two rooms:
a teacher running a class, and a parent with two or three kids. This plan sits **after**
the Supabase integration step (`docs/two-worlds-plan.md` §7 decision 5, §8): classes need
accounts and shared state, and the shipped sync foundation (`src/lib/sync.ts`,
`src/lib/merge.ts`, `docs/schema.sql`) is the substrate everything below stands on.
Local-first stays non-negotiable: a classroom is a *reader and meeting place* for data the
sync layer already moves — never a gate on practice.

---

## 1. What exists today (honest audit)

- **Household multi-profile, one browser.** `src/lib/store.ts` keeps
  `profiles: Record<string, ProfileData>` + `activeId`; `ProfilePicker.tsx` switches;
  `src/lib/auth.ts` is a seam where `signIn(id)` is just `switchProfile`. A family shares
  one machine fine — nothing crosses devices.
- **Family & Schools page** (`src/pages/Family.tsx`, route `family` in `src/main.tsx:83`):
  a *real* guardian summary of the active profile only (7-day minutes, streak,
  `curriculumProgress` lessons done, WPM sparkline, `CalendarHeat`), safety bullets, and
  the **Classroom concept card** — a table of six fake students seeded from
  `hashStr('classroom-demo')` plus a promise list (assign lessons/goals, pace-band races,
  reports, per-student accessibility, school accounts with no kid emails).
- **Simulated community, honestly labeled.** `dailyBoard()` in `src/lib/challenge.ts`
  fabricates 14 deterministic rivals per day/age division and merges your real score;
  `Challenge.tsx:125` says "Board rivals are simulated in this offline build". Your real
  best persists in `data.daily[dayKey]`. `activityFeed()` fabricates friend events for
  `Dashboard.tsx` (shown only when `competitive && !hideLeaderboards`, line 155).
- **Race rooms are theatre with a real stage.** `RaceHub.tsx` private rooms generate a
  `TYP-###` code and fake friends who join and ready-up on `setTimeout`, with the copy
  "Offline demo — friends here are simulated." The lobby UI (code display, roster, ready
  dots, host-start) is finished and reusable. `RaceLive.tsx` renders lanes
  (`progress/wpm/finishedAt`) from a ref updated on a 40 ms tick — exactly the render
  model a real room needs; only the *source* of other lanes' progress must change.
- **Duel & co-op.** `DuelGame.tsx` is best-of-seven against a pace-simulated rival
  (absolute tiers + a capped "matched" tier). `Games.tsx:94–98` shows the adult-only
  co-op card: "two players share one transmission, each typing alternating lines —
  coming with online play. Concept preview."
- **Sync foundation shipped, dormant.** `touch()` stamps + per-section `touched`
  (`store.ts`), `SyncAdapter`/`collectChangeset` with a no-op `localSync` (`sync.ts`),
  per-section merge rules (`merge.ts`), and `docs/schema.sql` with owner-only RLS.
  `package.json` has no supabase dependency yet — the integration is genuinely "later".

Bottom line: every multiplayer surface today is a well-labeled simulation and every
single-player system is real. Classroom's job is to swap the simulations' data source,
not to invent new UI.

## 2. The Classroom concept

**Who it serves.** (a) A teacher with 10–35 kids on school machines with flaky wifi and
shared devices. (b) A parent with 2–3 kids who today share one browser via multi-profile
— a class gives them cross-device (school + home) plus the same dashboard and challenges.
One mechanism, two labels ("class" / "family circle"); identical tables.

**The smallest version that is real** — every teacher-facing number is a read over data
the sync layer already pushes; students need zero new instrumentation:

1. **Teacher creates a class → join code.** Teacher account is a normal (adult) Supabase
   auth user; the class row carries the code.
2. **Kids join by code — no emails** (flows in §5).
3. **Teacher dashboard**: the `Family.tsx` concept table made real. Per student: current
   world + spot ("Treetop Isle · spot 3"), stars, lessons done, minutes this week — all
   derived from `lesson_progress` + per-day minutes, which sync already carries. A kid's
   star lands on the dashboard even if they never open a single classroom screen.
4. **Assignments**: `{ kind: 'lesson' | 'minutes' | 'world', target, dueAt }`. "Everyone
   clear Meadow Isle spot 4 this week" = `lessonIds: ['h2']` — spots are lesson nodes
   (`KidHome.tsx:106` counts "N of M spots"; W1's lesson order is b1, b2, h1, **h2**, …).
   Completion is *computed*, not tracked: lesson done at `stars ≥ 1` (the same bar as map
   unlock, two-worlds plan §2.4); minutes done when the `days` sum over the window meets
   the goal. No `assignment_progress` table — no second write path to drift.
5. **Class daily challenge with a real board.** `dailyChallenge()` already generates
   identical text per day/age deterministically on every client — zero server text
   distribution. A student submits one best-score row (mirroring the local
   `data.daily[dayKey]` upsert in `Challenge.tsx`); the board is one query; `scoreFor()`
   is unchanged. Trust model is a classroom, not an open ladder: server sanity bounds on
   wpm/acc, and a teacher who knows their kids. The global "division" board stays
   simulated-and-labeled for non-members.

Student surface: one "My class" card (assignments due + class board) on `KidHome.tsx` /
`Journey.tsx`, join entry in Family/Settings. Teacher surface: `Family.tsx` graduates
from concept to real when the signed-in user owns a class.

## 3. Cooperative & competitive play

Upgrade paths for what's built, split by what genuinely needs realtime:

| Feature | Mode | Mechanism |
|---|---|---|
| Race rooms | **Realtime** | Supabase Realtime channel per room: presence for roster/ready, broadcast for progress |
| Co-op "shared transmission" | **Realtime (line-granular)** | Broadcast on line completion only |
| Classmate duels | **Async** | Challenge/response rows; opponent's recorded run replayed as the rival |
| Assignments, class board, feed | **Async** | Plain table reads/writes; optional `postgres_changes` for live dashboard refresh |

- **Real race rooms.** Keep `RaceSetup` (`src/lib/race.ts`, `kind: 'room'`) and the whole
  `RaceHub` lobby UI; replace the `setTimeout` joiners with channel presence. In-race,
  broadcast your progress at ~200 ms and interpolate remote lanes locally — `RaceLive`'s
  40 ms render tick over a lanes ref absorbs this without restructuring. Finish order is
  authoritative via a results insert, not last-seen broadcast. Real codes need more
  entropy than `TYP-###` (900 combos): 6 chars from an unambiguous alphabet.
- **Co-op shared transmission** (the `Games.tsx` card, made real): two players, one text,
  alternating lines; your partner's lines fill in as they land. Turn-taking makes it
  latency-tolerant — events are line completions, never keystrokes — which is why it's
  the right *first* co-op. Score the mission on combined accuracy + time; works for
  class pairs and for two siblings on two devices.
- **Duels between classmates, async.** Challenger types a seeded phrase set (both sides
  derive identical text from the duel seed, like the daily); per-line times are stored;
  the opponent races that recording as a rival — the replay mechanism already exists in
  the ghost lane (`RaceLive`) and `DuelGame`'s pacing. Resolves on response or deadline.
  No realtime, no simultaneity, still feels head-to-head.
- **Out of scope**: ranked seasons (`RaceHub` concept card) — cross-class matchmaking is
  a different safety/scale problem and stays a labeled concept.

## 4. Dependency ordering & schema

**Hard boundary: everything above requires the Supabase step to have landed** — accounts
(auth), synced `lesson_progress`/minutes (or the dashboard has nothing to read), RLS
(the privacy mechanism), Realtime (rooms). Applying the strict rule — nothing that fakes
multi-device sync — almost nothing ships before it:

- Legitimate pre-Supabase: a **household dashboard** on `Family.tsx` summarizing *all
  local profiles* (the store already holds every profile in this browser) — real, no
  network pretense. Small, optional. And this document.
- Not legitimate: any join-code, board, or class UI backed by local fakes. The product
  already has exactly the right amount of simulation, clearly labeled.

**Schema extension** (append to `docs/schema.sql` at build time):

```sql
create table classes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null,
  join_code text not null unique,
  settings jsonb not null default '{}',   -- { hideBoard?, … }
  created_at timestamptz not null default now()
);
create table class_members (
  class_id uuid references classes (id) on delete cascade,
  profile_id text references profiles (id) on delete cascade,
  display_name text not null,             -- safe generated name; what peers see
  teacher_note text,                      -- e.g. real first name; class-owner eyes only
  role text not null default 'student',
  joined_at timestamptz not null default now(),
  primary key (class_id, profile_id)
);
create table assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  kind text not null check (kind in ('lesson', 'minutes', 'world')),
  target jsonb not null,                  -- { lessonIds } | { minutes } | { worldId }
  note text, due_at timestamptz, created_at timestamptz not null default now()
);
create table class_daily_scores (
  class_id uuid references classes (id) on delete cascade,
  profile_id text references profiles (id) on delete cascade,
  day text not null,                      -- dayKey, mirrors data.daily
  wpm real not null, acc real not null, score integer not null,
  submitted_at timestamptz not null default now(),
  primary key (class_id, profile_id, day) -- upsert keeps the best score, like data.daily
);
```

**RLS extension** (the part worth doing carefully):

- `classes`: owner all; members may `select` their own class. `class_members`: owner all;
  students read their classmates through a `class_roster` view that excludes
  `teacher_note`.
- **Joining is a security-definer RPC** `join_class(code, profile_id, display_name)` —
  validates the code, inserts membership, rate-limited, member cap (~40). `join_code` is
  never selectable by students; codes are teacher-rotatable.
- **Teacher visibility is a read-only policy extension**, not a widening of ownership:
  class owners may `select` `lesson_progress` (and per-day minutes) for member profiles.
  Deliberately *not* the `profiles` row (it carries `settings`/`key_stats` jsonb) and
  *not* `sessions` (timelines, `keyAgg`). Deleting a `class_members` row severs the whole
  read path instantly.
- One sharp edge to settle during the Supabase step: `days` currently lives inside the
  `profiles` jsonb row (`schema.sql`). Split it into a `day_minutes` table then — teacher
  minute-reads become a clean policy instead of a jsonb carve-out. Recommended.
- Class state is shared state, not profile state: it does **not** ride
  `ProfileData.touched`/`collectChangeset` — it's read/written directly, while profile
  sync stays exactly as designed.

## 5. Safety & privacy for minors

- **No kid emails, ever** (the `Family.tsx` promise, now enforced by flow). Two joins:
  - *Kid on their own device*: the local profile already exists; joining =
    `signInAnonymously()` to own the synced profile, then the `join_class` RPC. No email,
    password, or PII. Documented honestly in-app: anonymous accounts are device-bound —
    a lost browser loses the link (local data survives locally; the teacher removes the
    stale member and the kid rejoins; `merge.ts` reconciles whatever is reachable).
  - *Teacher-managed roster*: teacher pre-creates slots with display names and prints
    one-time claim codes; a kid enters the code once and the slot binds to that device's
    anonymous account. This is the "school-managed accounts" card promise.
- **Display names**: peers only ever see picker-generated safe names — the
  `randomKidName()` pattern (`store.ts`), same shape as `CLASSMATE_NAMES`
  ("BrightMaple07"). Free-text names never reach a shared surface; a real first name may
  live in `teacher_note`, visible to the class owner alone.
- **What a teacher can see**: roster, per-student world/spot/stars, practice minutes,
  class board scores, assignment completion. **Cannot see**: keystroke data (`keyStats`,
  `keyAgg`), replays/timelines, settings, custom texts, other classes, anything after
  removal.
- **`hideLeaderboards`** (`Settings.tsx:74`; honored at `Dashboard.tsx:155` and
  `Challenge.tsx:113–128`) extends to class: the student sees no boards *and* is withheld
  from peer-visible boards; the teacher still sees their score privately. A teacher can
  set `classes.settings.hideBoard` to run a board-free class — the "nobody is singled
  out" principle from the concept card.
- **No chat of any kind** in rooms or co-op ("No open chat — ever"). Progress bars and
  results are the only channel.
- **Copy is a feature**: the `Family.tsx` bullet "All data lives in this browser. Nothing
  is uploaded." and every "simulated"/"offline demo" string must be revised in the same
  change that makes each surface real.

## 6. Execution plan — one program

One program, one boundary: nothing starts until the Supabase integration itself has
shipped (implement `SyncAdapter` + `auth.ts` against a real project, first-sign-in upload
via `merge.ts` — its own ~2–3 sessions per two-worlds plan §8, not counted here).

Then, ordered by dependency but run as one continuous effort — **~10–13 focused
sessions**:

1. ~~Schema + RLS + `join_class` RPC + the `day_minutes` split~~ — **done**
2. ~~Client class module + join flows (anon auth, code entry, safe-name picker)~~ — **done**
3. ~~Teacher dashboard: concept table made real, assignment create/track, roster + claim
   codes~~ — **done**
4. ~~Class daily challenge: submit + real board + `hideLeaderboards`/`hideBoard` rules~~ — **done**
5. Real race rooms: presence lobby, progress broadcast + interpolation, results, new
   code format, `RaceHub` copy — 2
6. Co-op shared transmission (line-granular channel; class pairs and family) — 1.5–2
7. Async classmate duels (seeded text, recorded-run rival, deadline) — 1
8. Safety + verification pass: two-browser end-to-end, throttled/offline mid-race
   behavior, RLS tests as SQL, full copy audit, `tsc` clean — **done for 1–4**
   (RLS suite, browser end-to-end, copy audit, `tsc` clean); the race-specific
   throttled/offline checks belong with item 5.

Items 1–4 are the point where a teacher gets full value ("Classroom core"); 5–7 are
"Play together". That split is dependency order inside one program, not release phases.

**Definition of done**

- Teacher creates a class on machine A; a kid joins by code on machine B with no email;
  the kid's next lesson star appears on the teacher dashboard without the kid opening
  any classroom UI.
- "Clear Meadow Isle · spot 4 this week" shows per-student completion computed purely
  from `lesson_progress`.
- Two real browsers race in one room; a third joins mid-lobby; a mid-race disconnect
  degrades to a local finish and the result still records.
- The class board contains only real classmates; a `hideLeaderboards` student is
  invisible to peers and visible to the teacher.
- No PII path exists for a student: no email field anywhere, no free-text name on any
  shared surface.
