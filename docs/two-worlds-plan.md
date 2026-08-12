# KeyTopia: The Two Worlds Plan

One plan, executed as one program. Two parallel journeys — **The Archipelago** (kids)
and **The Ascent** (grown-ups) — built on one shared progression engine: five worlds,
gentle early, demanding late, expandable past five. The journey map becomes the home
of the whole product for both audiences; everything we capture today keeps being
captured, but the pages guide one step at a time instead of showing everything at once.

This supersedes the phased approach in `kid-world-scaling.md` §6. The audit (§1), the
data-model traps (§4) and the map componentization notes (§5) of that doc carry over
and are folded in below. The night island and Cipher Isles become expansion worlds
(W6+) instead of the main line.

---

## 1. Vision & principles

1. **Two skins, one skeleton.** Kids and adults progress through the *same* five-world
   structure with the same rules. Only the rendering, tone and celebration style
   differ. One engine to maintain, two experiences to love.
2. **Gamified does not mean childish.** The adult path is a beautifully drawn
   expedition — trail map, waypoints, camps, summit flags. Progress you can *see* is
   the mechanic; the art direction sets the age.
3. **Never too hard too soon.** Difficulty ramps across worlds, not within them.
   World 1 is a fast, guaranteed win. World 5 is genuinely demanding.
4. **Guide one step, keep all the data.** Every page leads with exactly one primary
   action ("Continue"). All analytics we capture today (per-key stats, rhythm,
   sessions, replays) keep being captured — they move behind the Progress door
   instead of greeting the user.
5. **The map is the home.** For both audiences, landing in the app means seeing your
   world and where you stand in it.

---

## 2. The shared skeleton: five worlds

### 2.1 Curriculum regrouped (no progress lost)

The existing 9 stages / 37 lessons (`REGION_META`, `src/lib/curriculum.ts`) regroup
into five worlds. **Lesson ids do not change** — every existing profile's
`data.lessons` record remains valid, and world membership is pure metadata.

| World | Name (working) | Stages folded in | Lessons | Skill story |
|---|---|---|---|---|
| W1 | First Steps | S0 Base Camp + S1 Heartlands | 7 | Posture, anchors, home row |
| W2 | The High & Low Roads | S2 Skyreach Ridge + S3 Deeproot Vale | 10 | Top row, bottom row — full alphabet |
| W3 | The Written Word | S4 Twin Gates + S6 Punctuation Straits | 8 | Capitals, punctuation, real sentences |
| W4 | Numbers & Glyphs | S5 Numeral Peaks + S7 Glyph Foundry | 8 | Number row, symbols, code |
| W5 | The Flow | S8 The Long Roads + **6 new lessons** | 10 | Rhythm, endurance, dictation, real-world texts |

- W5's new lessons are generated, not authored: they wrap the existing
  `buildModeText` generators (`rhythm`, `endurance`, `dictation`, `blind`,
  `realworld`) that the curriculum doesn't use today (`src/lib/adaptive.ts`).
- **W6+ expansion slots** ship in the registry from day one (empty). First
  candidates, already designed in `kid-world-scaling.md`: the Starlit remix island
  (kids) / Night Ascent (adults) and Cipher Isles (code-heavy).

### 2.2 One node = one lesson

Today the kid map draws 9 stage-nodes. In the new design **every lesson is a stop on
the map** — 7 to 10 stops per world. This is the single biggest "guide me" win:
the map literally shows the next thing to do, Duolingo-style, and finishing any
lesson visibly moves you. Stage boundaries survive as *areas* on the map (a named
grove, a camp) rather than as nodes.

### 2.3 Difficulty curve (gentle early, steep late)

Targets stay formula-driven (`buildLessonPlan`), retuned from a per-stage line to a
per-world curve:

- `targetWpm = base(world) + step(world) * lessonIndexInWorld`, where W1–W2 use a
  flatter step than today and W4–W5 a steeper one. Kid multiplier (×0.72) stays.
- Accuracy gates: 92% in W1, 94% by W3, 96% in W5.
- 3-star thresholds keep the current shape (`starsFor`) — stars are the *optional*
  hard mode inside every world; advancing never requires them.

### 2.4 Unlock rules

- Within a world: next lesson unlocks when the previous has ≥1 star (linear, clear).
  A stage-area is "cleared" at the existing 60% rule for review purposes.
- Next world: unlocks when every lesson in the current world has ≥1 star.
- Completing a world = a **celebration moment** (fireworks + guardian cheer for
  kids; flag-plant + badge for adults) using the existing `useUi.celebrate`
  machinery. This fixes the documented anticlimax.
- `settings.unlockAll` keeps bypassing everything (teacher/parent escape hatch).
- **Graduation (kids)** decouples from lesson counts (the trap in
  `kid-world-scaling.md` §4): the offer appears on completing W2 or reaching
  level 8, and stays visible thereafter. Graduating switches the skin to The
  Ascent at the same position — progress is shared, so nothing resets.

### 2.5 The Guide — the map's companion (Learn/Quests, renamed & upgraded)

The map answers *where am I*; a list view must keep answering *what is each step
and what does it ask of me*. The current Learn (adult) and Quests (kid) pages
survive as that companion, renamed and upgraded rather than removed:

- **Adults: "Trail Guide"** — a toggle view inside Journey (map ⇄ guide, so nav
  stays five doors). Every waypoint listed with: name, **typing focus** (the keys
  it introduces and the skill it trains — the data already exists as
  `REGION_META.skill`/`desc` and each lesson's key set), the **requirement to
  pass** (target WPM + accuracy for 1 star, spelled out), star thresholds, and
  current status. Camps and legs group the list visually.
- **Kids: "Quest Book"** — the existing Quests nav door, restyled as a sticker
  book: one row per stop with the guardian, a kid-worded focus line ("Learn the
  reach up to E and I!"), earned stars, and what the next star needs.
- Locked steps show their focus too — seeing *what's coming* is part of the
  guidance ("Numbers live on Crystal Caverns, two islands away").

### 2.6 The pedagogy underneath (why this path)

The sequence is not invented; it follows the established evidence on how typing
and motor skills are learned, and each principle has a concrete home in the app:

| Principle (evidence base) | Where it lives |
|---|---|
| **Home-row anchoring, small key sets introduced progressively** — the standard instructional sequence since typewriting research | W1→W2 order; each lesson introduces 1–3 keys with dedicated drills |
| **Accuracy before speed** — errors practised early become automatized errors; speed must emerge from accurate strokes (motor-learning consensus) | Accuracy gates (92%→96%), star formula requiring accuracy first, Kip's coaching rules |
| **Deliberate practice on weaknesses with immediate feedback** (Ericsson) | The adaptive engine: per-key stats → weak-key drills; per-keystroke feedback; post-session coach line |
| **Distributed practice beats massed practice** — short frequent sessions retain motor skill better | Short lessons, daily goal minutes, streaks, daily challenge |
| **Chunking: letters → bigrams → words → sentences** builds larger motor programs (Logan & Crump's two-loop model of skilled typing) | Lesson drill ladders; letter-pair (bigram) stats driving practice generation |
| **Blocked practice for new material, interleaved review for retention** | New-key drills within a lesson (blocked); adaptive sets and the 3-star polish loop (interleaved) |
| **Typing without looking** accelerates map-building once anchors exist | Lights-out mode; on-screen keyboard guide that fades as mastery grows |
| **Rhythm/evenness correlates with expertise** — experts show low inter-key variance | Consistency metric, Rhythm studio, Wordflight |
| **Time-on-task is the biggest predictor; motivation buys time-on-task** | The entire world/game layer — gamification in service of practice volume |

Two additions this plan makes because the science asks for them:

- **Camp checkpoints (new)**: each camp/stage boundary offers a short optional
  mixed-review drill over everything learned so far — spaced retrieval formalized,
  rewarded with a badge, never a gate.
- **Honest position on key order**: we teach row-by-row (the dominant school
  method) rather than letter-frequency order (keybr's approach). Both are
  defensible; frequency order reaches "real words" marginally sooner, row order
  builds cleaner spatial anchors. Our adaptive engine compensates for the main
  weakness of either order by re-weighting whatever keys *this* learner struggles
  with — which matters more than the introduction order itself.

---

## 3. The kid path: The Archipelago

**The fiction**: KeyTopia is a sea of islands. Each world is an island; each lesson
a stop on its road; each island has a guardian pal who walks with you and a
landmark finale. A sea chart connects them, and your boat carries you between.

### 3.1 The five islands

| World | Island | Palette & mood | Guardian | Finale landmark |
|---|---|---|---|---|
| W1 | Meadow Isle | Spring greens, flowers, the current island's look | Clementine the cat | The Great Oak |
| W2 | Treetop Isle | Deep forest, canopy walkways, fireflies | Miso the fox | The Canopy Bridge |
| W3 | Lantern Harbor | Seaside town, boats, string lights | Pip the frog | The Lighthouse |
| W4 | Crystal Caverns | Purple/teal gem cave, glowing runes | Waffles the panda | The Geode Gate |
| W5 | Cloud Castle | Sky island, rainbows, wind | **Biscuit the owl (new pal)** | The Castle (today's castle, promoted) |

- Each island reuses the proven map anatomy from `KidHome.tsx`: `ISLAND` blob +
  `NODES` + `curveThrough` road + scenery primitives (`Tree`, `Flower`,
  `CloudPuff`, critters) — now data-driven per island (path, node list, palette,
  decor set, guardian), per `kid-world-scaling.md` §5. Gradient ids get suffixed
  per island (documented collision).
- One new avatar preset (owl) joins `AVATAR_PRESETS`/`PIXEL_PALS` so five islands
  have five distinct guardians.

### 3.2 The journey

1. **Sea chart** ("My World" zoomed out): five islands on the sea, done islands in
   full colour with a flag, the active island gently bobbing, future islands as
   fog silhouettes with a `?`. The boat sits by the active island. Tapping it
   zooms into the island map (view state, not a new route — kid nav stays 4 items).
2. **Island map**: the child's avatar stands on the current stop, guardian beside,
   signpost naming the stop. Tap where you stand → lesson starts. Behind: cleared
   stops with stars, ahead: numbered dots.
3. **World complete**: celebration overlay, the landmark lights up, the boat
   animates to the next island on the chart, new guardian waves hello.
4. **After W5**: the castle throne moment + the graduation card (if still a kid
   profile) + W6 fog on the horizon ("more islands are forming…").

### 3.3 Guided kid pages

- KidHome slims to: sea chart/island map, ONE quest card ("Let's go!"), daily
  challenge chip, newest stickers. The games grid moves fully behind Play.
- Post-lesson: stars + one Kip line + a single big **Next** button that chains
  straight into the following stop (details expandable, never front-and-centre).

---

## 4. The grown-up path: The Ascent

**The fiction**: one long expedition from the valley floor to the summit, drawn as
an elegant trail map — national-park cartography, not cartoon. Contour lines,
a dashed trail, waypoint dots, camp markers, summit flags.

### 4.1 The five legs

| World | Leg | Map section & mood |
|---|---|---|
| W1 | The Valley | Riverside trailhead, open meadow — easy warm light |
| W2 | The Forest | Switchbacks under tall trees |
| W3 | The Ridgeline | Open views, the trail narrows |
| W4 | The Glacier | Technical terrain, ice blues |
| W5 | The Summit Push | Thin air, night sky, the peak |

- Rendered with **theme CSS variables** (unlike the kids' literal palette) so The
  Ascent looks right in every adult theme, dark and light.
- One continuous mountain profile; each leg is a zoomed section. A slim
  **elevation strip** at the top of the journey page shows overall position —
  the adult equivalent of the sea chart.
- Waypoints = lessons (same node mechanics as kids: current highlighted, tap to
  start). Camps mark stage boundaries; completing a leg plants a flag with an
  understated celebration (badge toast + flag animation, no confetti rain).
- Copy stays adult: "Leg 2 of 5 — The High & Low Roads · 4 waypoints to camp."

### 4.2 Guided adult shell (the density fix)

Today's adult landing is a dense dashboard. It becomes:

- **Journey** (new home): the trail map, one "Continue" CTA, a compact strip of
  streak/level/today's goal, and a small "Today" rail (daily challenge + active
  missions, condensed).
- **Nav slims to five**: Journey · Train (practice hub) · Arena (games + races
  merged under one door) · Progress · Settings.
- **Progress absorbs the dashboard**: everything currently on Dashboard +
  Progress + Badges lives here — mastery keyboard, WPM/accuracy charts, heatmaps,
  rhythm, replays, records, badge wall. *Nothing is deleted; it is re-homed.*
  All capture (sessions, keyStats, replays) is untouched.
- **Lesson flow**: finish → result with coach line → single **Next waypoint**
  button; the full stat breakdown is one tap deeper.

---

## 5. Data model & migration (safe by construction)

- **`WORLDS` registry in code** (`src/lib/worlds.ts`): `{ id, name, kidSkin,
  adultSkin, stages: number[], newLessons?, palette(s), guardian }`. Worlds are
  derived views over the existing curriculum — the source of truth for progress
  remains `data.lessons`.
- **Derive, don't persist**: world unlocked/completed/active are all computable
  from `data.lessons`. The only persisted addition is cosmetic:
  `ProfileData.journey?: { lastWorld?: string }` (which map you last looked at).
  Store `version` bumps 3 → 4 with a near-no-op migrate, following the existing
  in-place pattern. **Existing profiles land in exactly the right place on day
  one** because their lesson records already say what's done.
- New W5 lessons get namespaced ids (`w5-f1`…), per the scaling doc; `lessonById`
  searches the concatenation (ids unique).
- `nextLesson`, `curriculumProgress` gain a world scope; graduation reads the new
  explicit rule (§2.4), not `prog.total` — closing the documented gate-shift trap.
- Kids and adults share every byte of progress — switching skin (graduate, or the
  Settings toggle) never converts data.

---

## 6. Build scope — one program, six workstreams

Executed together as one continuous effort; workstreams order themselves by
dependency, not by release phases. Estimated honestly: this is the largest single
change since the initial build (roughly 8–12 focused working sessions).

**A. Engine** — `WORLDS` registry; curriculum regroup + W5 generated lessons;
difficulty retune (§2.3); unlock + graduation rules; camp checkpoint drills
(§2.6); store v4; world-scoped selectors; celebration triggers.

**B. Journey components** — shared `<JourneyMap>` mechanics (nodes, road,
current-marker, tap-to-start, a11y labels) with two renderers: `IslandMap`
(extracted from KidHome, made data-driven, gradient ids fixed) and `TrailMap`
(new, theme-var native). Sea chart + elevation strip as the two overview surfaces.

**C. The Archipelago** — five island skins (paths, palettes, decor sets), Biscuit
the owl (avatar preset + pal), boat travel + world-complete celebrations, fog
islands, KidHome slim-down.

**D. The Ascent** — five trail legs, camps/flags/milestones, Journey page as adult
home, "Today" rail.

**E. Guided shell** — adult nav 5 doors, Arena merge, Progress consolidation
(Dashboard + Progress + Badges re-homed), post-lesson Next-chaining for both
paths, and the two Guide views (§2.5): Trail Guide toggle inside Journey,
Quest Book restyle of the kid Quests page.

**F. Content & coach** — W5 lesson definitions over existing generators; per-world
Kip coach lines and quest copy; region/stop flavor text for all ten skins.

**Definition of done**
- A brand-new kid lands on Meadow Isle stop 1; a brand-new adult lands at the
  Valley trailhead — each with one obvious button.
- An existing profile (yours) opens at the correct world/stop with all history,
  stars, badges and records intact.
- Completing W1 fires a celebration on both paths; completing W5 crowns the
  journey; W6 slot renders as fog/"beyond the summit".
- A kid graduating mid-journey continues on The Ascent at the same position.
- Adult analytics: every chart and stat reachable today is reachable under
  Progress. Nothing captured today stops being captured.
- Both paths verified in browser end-to-end (including a simulated all-done
  profile), mobile layouts, reduced motion, and dark + light adult themes.
- `tsc` clean; migration tested against a copy of a real v3 profile.

---

## 7. Decisions — **all four approved 2026-08-12**

1. **Adult home = Journey map** (dashboard re-homed under Progress). ✅ Approved.
2. **Arena merge** (Games + Race under one nav door). ✅ Approved.
3. **World names** — working names in use; rename freely later. ✅ Approved.
4. **Kid stop density** — one node per lesson (7–10 per island). ✅ Approved;
   fallback stays nodes-per-stage with a lesson drawer if maps feel crowded.
5. **Database timing** (decided 2026-08-12): the program ships **database-ready,
   database-later** — the sync foundation below is part of the program; the live
   Supabase integration is the step immediately after it lands. Rationale: the
   program churns the exact data shapes a sync layer would have to stabilize;
   coupling the two multiplies risk on both.

---

## 8. Persistence foundation — database-ready, database-later

The app is local-first today (zustand `persist` → localStorage `keytopia-v1`) and
**stays local-first forever**: the browser store remains the source of truth the UI
reads and writes; a database is a *sync target*, never a gate the UI waits on.
Kids on school machines with flaky wifi keep working. What the program lays down so
the later Supabase step is an integration, not a rewrite:

1. **All mutations through named actions** (already true — `recordSession`,
   `patch`, `finishAssessment`, …) and now stamped: every profile section gets an
   `updatedAt`, and sessions get stable client ids. Dirty-tracking rides on this.
2. **A `SyncAdapter` seam next to the existing auth seam** (`src/lib/auth.ts` was
   built for exactly this moment): `pushChanges(profileId, changeset)`,
   `pullProfile(profileId)`, with a no-op localStorage implementation shipped.
   Supabase later = implementing this one interface + swapping `auth.ts`.
3. **Merge semantics defined now, in code**, per section — the part that hurts to
   retrofit: sessions **append-only union** (trivially syncable), lessons
   **max(stars) per id**, badges/unlocks **set union**, xp/records **max**,
   keyStats **last-write-wins by `updatedAt`**, settings **last-write-wins**.
   The same functions serve future multi-device merge and the v4 migrate.
4. **Relational-friendly shapes**: the future schema falls straight out —
   `profiles`, `sessions` (append-only rows), `lesson_progress`, `key_stats`,
   `badges`, `settings`. A `docs/schema.sql` draft ships with the program so the
   Supabase step starts from a reviewed schema with row-level security per
   profile owner.
5. **Local history cap (the one real performance angle)**: `sessions` currently
   grows unbounded in localStorage — a slow-boot problem waiting to happen after
   years of practice. Once the DB archive exists, local keeps a rolling window
   (e.g. last 300 sessions) and the database holds the full record; aggregates
   (keyStats, records, xp) are already summaries and stay small. To be clear:
   the DB adds durability and capability, not speed — local-first exists so it
   can never *cost* speed either.
6. **What the later Supabase step looks like** (owner-side, ~an hour): create the
   Supabase project (account creation is yours to do), run `schema.sql`, put the
   project URL + anon key in `.env` — then the integration session implements
   `SyncAdapter` + auth against it, and existing local profiles upload themselves
   on first sign-in via the merge functions above.

### The instant bar (Linear-style, non-negotiable)

Acceptance criteria for the sync layer, set now so the integration session
inherits them:

- **Every user action commits to the local store synchronously.** Optimistic
  always; sync is fire-and-forget behind it. The sync layer adds 0ms to any
  interaction *by construction* — it is off the critical path, not merely fast.
- **No user-facing operation ever blocks on the network.** The only permitted
  network-blocking moment is the sign-in handshake itself.
- **Boot paints from localStorage before any network call.** Returning users
  never see an auth-gate spinner — the local session renders immediately and
  revalidates in the background. Server reconciliation applies after first
  paint through the §8 merge functions, patching in quietly (no flash-replace).
- **Transient failures are invisible.** Outbox queue with retry/backoff; no
  error toasts for network blips. The only surface is one ambient indicator
  (✓ synced / ↻ syncing / ⌁ offline) tucked in the profile corner.
- **Conflicts never ask.** The merge semantics above resolve everything
  automatically — a "which version?" dialog is a design failure here.

Workstream **A (Engine)** absorbs items 1–3; item 4 lands with **F** as a docs
deliverable. Nothing else in the program depends on any of this.
