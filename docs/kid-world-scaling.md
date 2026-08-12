# Kid World Scaling — what happens after the castle?

Design doc. What a kid experiences after finishing all 9 stops of the island map
(`src/pages/KidHome.tsx`), and how the kid journey scales beyond one island.
No code was changed; every claim below is cited against the current source.

---

## 1. Current state audit

### The journey today (verified in code)

- **Curriculum**: 9 stages from `REGION_META` (`src/lib/curriculum.ts:33`), Base Camp → The
  Long Roads. Lesson counts per stage: 2, 5, 6, 4, 4, 4, 4, 4, 4 = **37 lessons** (all
  layouts; `buildStages(layout)` swaps keys, not counts). Max star haul: **111 stars** (37 × 3).
- **Lesson content is generated, not authored**: `buildLessonPlan(layout, lesson, age, seed)`
  (`curriculum.ts:181`) assembles drills from pools in `src/lib/words.ts` — `KID_WORDS`
  (~84 words), `KID_SENTENCES` (20), `COMMON_WORDS` (~700), `SENTENCES` (40), `PARAGRAPHS` (8).
  Targets come from a formula, not data: `targetWpm = round((10 + stage * 4.5) * (kid ? 0.72 : 1))`
  — kid targets run 7 WPM (stage 0) to 33 WPM (stage 8); `targetAcc` is 92 (stages 0–1), else 94.
- **Stars** (`starsFor`, `curriculum.ts:284`): 0 below 85% acc; 1 star baseline; 2 stars at
  targetAcc + 75% of targetWpm; 3 stars at targetAcc+2.5 and full targetWpm.
- **Unlocks** (`stageUnlocked`, `curriculum.ts:292`): next stage opens when ≥60% of the previous
  stage's lessons have ≥1 star (`ceil(len * 0.6)`); `settings.unlockAll` bypasses.
- **Map = curriculum, 1:1**: `NODES` (9 coordinate pairs, `KidHome.tsx:19`) map stop *i* to
  stage *i*. The road is `curveThrough(NODES)`; travelled portion is
  `curveThrough(NODES.slice(0, doneCount + 1))` (`KidHome.tsx:100-102`). The castle is drawn at
  `translate(926 96)` next to the final node `[925, 138]`.
- **Graduation** (`KidHome.tsx:98`): `readyToGraduate = prog.done >= floor(prog.total * 0.5) || lvl.level >= 8`
  → **18 of 37 lessons, or level 8** (~6,480 cumulative XP per `xpForLevel` in `src/lib/metrics.ts:137`).
  The card patches `settings.kidWorld = false` → adult dashboard; reversible via the toggle in
  `src/pages/Settings.tsx:128`.

### The end-game, precisely

`nextLesson` (`curriculum.ts:301`) has two passes: first 0-star lesson in an unlocked stage,
then any lesson below 3 stars. So after "finishing" the island:

1. **All 37 lessons at ≥1 star**: avatar stands at the castle (`currentIdx` falls back to the
   last stop, `KidHome.tsx:96-97`), the map reads "9 of 9 lands explored" — and that's it.
   **No celebration fires. Nothing on the map changes.** The quest card silently switches to
   offering polish lessons ("pass 2").
2. **All 37 at 3 stars**: `nextLesson` returns `null`, the quest card becomes
   *"Free practice in your world"* → `/app/train/adaptive` (`KidHome.tsx:284-293`), forever.
3. Games (7 + race), daily challenge (`dailyChallenge`, `src/lib/challenge.ts:16`), weekly
   missions (`rollMissions`), stickers (40 badges in `src/lib/badges.ts`) and theme/avatar level
   unlocks (`src/lib/themes.ts`) keep working indefinitely — the retention loops don't die,
   but the **map**, the centerpiece of the kid experience, goes permanently static.

**The gap**: the most engaged kid in the app reaches the castle and gets less feedback than
they got for any single lesson. There is no "you beat World 1" moment, and no next horizon.

---

## 2. Scaling directions (Mario-worlds lens)

### A. The Archipelago — authored themed islands (World 2, 3, …)

**What a kid sees**: finishing the castle triggers a celebration; the map zooms out to a sea
chart. Their island is now one of several; the little boat already painted at
`translate(24 244)` (`KidHome.tsx:156`) carries the avatar to World 2. Each island has its own
palette, guardians, and skill theme — e.g. World 2 "Cipher Isles" (numbers, symbols, code-for-kids,
deepening stages 5–7), World 3 "The Windward Isles" (speed/rhythm/endurance).

**Content needed**: mostly reparameterization. Stage generators for `numbers`, `symbols`,
`punct`, `ladder`, `paragraph` kinds already exist; `numberDrill` (`words.ts:216`) and the
mode generators in `buildModeText` (`src/lib/adaptive.ts:144` — speed, rhythm, recovery, blind,
dictation) are ready-made lesson cores. Real authored cost per island: a `REGION_META`-style
stop list (9 entries of flavor text), ~2 small kid text pools (e.g. `KID_CODE_LINES`,
extra `KID_SENTENCES`), palette + decor. Roughly a third of the original island's content cost.

**Effort**: L (map componentization + sea view + one new island ≈ 3–5 sessions).
**Risks**: raising difficulty enough to matter without new *kinds* of content; each further
island re-pays the authoring cost; sea view is new UI surface to maintain.

### B. The Second Quest — star-mastery remix of the same island

**What a kid sees**: after the castle, the same island reappears **at night** — dusk sky,
fireflies, moon, lantern-lit road (the `wildwood`/`midnight` themes prove the art direction
exists). Same 9 stops, but the signposts read "Starlit Base Camp"… Targets are harder, lines
longer, and stars are earned fresh. Zelda's Second Quest / Mario's hard-mode star worlds.

**Content needed**: none authored. `buildLessonPlan` already takes `seed` and computes targets
by formula — a remix pass is a multiplier (e.g. targetWpm × 1.35, drop the kid line-length
discount `kid ? 6 : 9` at `curriculum.ts:189`, pull one notch harder sentence pool). Night
palette = swap `LAND_COLORS`, the `kwSky`/`kwSea` gradient stops, and add star/firefly decor
to the existing scenery block.

**Effort**: S–M (1–2 sessions).
**Risks**: same geography twice can feel like a re-run if the re-theme is timid; difficulty
formula needs a ceiling check (33 WPM × 1.35 ≈ 45 WPM is genuinely hard for a kid — that's
the point, but 3-star thresholds should stay reachable); must not double-count graduation
progress (see §4).

### C. The Drifting Isles — procedural islands from the adaptive engine

**What a kid sees**: past the castle, fog parts around a small ever-changing isle. Its 4–5
stops are built from *their* weakest keys — `weakKeys(data.keyStats)` (`adaptive.ts:46`)
already ranks keys by `err*3 + slowness`, and `buildWeakKeyWorkout` / `buildAdaptiveText`
already generate the texts and the "why" copy. The isle reshapes weekly (seeded by `weekKey`,
like `rollMissions`).

**Content needed**: zero. It's a themed wrapper over the existing adaptive engine — which is
exactly what the current end-state ("Free practice" → `/app/train/adaptive`) already is,
minus the wrapper.

**Effort**: M as one special isle (1–2 sessions); L as "endless worlds".
**Risks**: as an *infinite* world structure it's weak — procedural stops have no collection
value, no finish line, and "an island made of your mistakes" needs careful framing for kids.
`weakKeys` requires ≥8 attempts per key and can be empty (the fallback at `adaptive.ts:95`
handles it). Best used as **one** recurring special stop, not as the scaling axis.

### D. Special isles — games, boss, seasons

**What a kid sees**: small non-curriculum islets on the sea chart: an Arcade Isle (fronting
`/app/games` — 7 games exist), a Lighthouse boss isle (daily challenge / an `expert` CPU race
from `CPU_LEVELS`, `challenge.ts:116`), seasonal dressing (winter island in December — decor
seeded by `dayKey`, deterministic like `dailyChallenge`).

**Content needed**: none — these are map-level *links* to systems that already exist
(daily, missions, races, games). Pure presentation.

**Effort**: S each, once a sea chart exists; the boss isle is S even without one (it can be a
10th node past the castle on the current island).
**Risks**: gimmick decay; must not fragment navigation the kid already has (`KID_NAV` has
Play and Race tabs — the isles are flavor, not the only door).

---

## 3. Recommendation

**Staged combination: B → A, with C and D folded in as single special isles.** Concretely:
ship the *castle celebration* first (it's missing today and costs almost nothing), then the
**Second Quest night island** as World 2, then the **sea chart + one authored island** as the
durable structure, decorated with a boss isle (D) and the drifting isle (C).

Why this order:

1. **Kids who finish everything are the most engaged users** — but they are also *few*.
   Graduation already exists as the designed exit at 50%/level 8 (`KidHome.tsx:98`), so
   post-castle content serves the minority who finish the island *and choose to stay kids*.
   That audience justifies clever reuse, not a content pipeline. B is the highest
   experience-per-authored-word option in the list.
2. **B is honest about what the curriculum is**: generated drills with formula targets. A
   remix pass exploits the existing `seed`/`age` parameters of `buildLessonPlan` instead of
   pretending the app has authored levels to spend.
3. **A is the right long-term shape** — but only after the island is componentized, and only
   one island at a time. World 2 (Cipher Isles) doubles down on stages 5–7 skills, which is
   also the pragmatic bridge toward graduation: a kid who clears a symbols/code island is
   ready for the adult dashboard anyway.
4. **C and D are amplifiers, not structures.** One drifting isle keeps the sea chart alive
   between authored islands; the boss isle gives the daily challenge a place in the fiction.

The exit ramp stays: graduation remains the headline card, and every new world should keep
showing it. Scaling the kid world must never become a reason to avoid graduating.

---

## 4. Data model & migration

Current persistence (`src/lib/store.ts`): zustand `persist`, key `keytopia-v1` (with legacy
`typerra-v1` carry-over at `store.ts:67-73`), `version: 3`, and a `migrate` that mutates
profiles in place with defaulting (`store.ts:352-370`). Lesson progress is a **flat record**:
`ProfileData.lessons: Record<string, LessonProgress>` keyed by lesson id (`'b1'`, `'t4'`, …).

### Representing worlds without breaking profiles

- **Namespace new lesson ids; never touch old keys.** World 1 keeps bare ids. World 2+ lessons
  get prefixed ids: `w2-b1`, `w2-t4` (hyphen, not colon — ids travel in the route
  `/app/lesson/:id`, `src/main.tsx:66`). Existing `data.lessons` entries remain valid forever,
  and turning the feature off loses nothing. **No key rewriting, no data loss, reversible.**
- **World registry in code, not in the store.** A `WORLDS` array next to `REGION_META`:
  `{ id: 'w2', name, unlock: (data) => boolean, buildStages: (layout) => StageDef[], palette, decor }`.
  `buildStages` gains a world variant; per-world stage ids stay 0–8 so `stageUnlocked`'s 60%
  rule works unchanged per world.
- **One small persisted addition**: `ProfileData.kidWorlds?: { active: string; unlocked: string[] }`
  (optional field). All reads default: `d.kidWorlds?.active ?? 'w1'`. Because it's optional and
  defaulted, the migrate step can be a no-op for old profiles; still bump `version` to 4 and
  initialize it in `migrate` for tidiness, following the existing in-place-mutation pattern.
- **Pin graduation to World 1 — this is the one real trap.** `curriculumProgress`
  (`curriculum.ts:318`) totals `allLessons(layout)`. If world-2 lessons are appended into
  `allLessons`, `prog.total` jumps 37 → 74 and the graduation gate at `KidHome.tsx:98`
  silently moves from 18 lessons to 37. Keep `allLessons(layout)` meaning world 1, and add
  `allLessons(layout, worldId)` / `curriculumProgress(data, worldId)` for the rest.
- **World-aware lookups**: `lessonById` (`curriculum.ts:122`) must search the concatenation of
  all worlds' lessons (ids are unique via prefix, so a flat find still works). `nextLesson`
  gains a world parameter driven by `kidWorlds.active`, so the quest card and the sidebar
  "Next quest" button (`Shell.tsx:83-88`) follow the world the kid is standing in — today
  pass 2 of `nextLesson` would forever drag them back to world-1 polish.
- **Untouched systems**: badges read sessions/keyStats/lesson counts (`first-lesson` uses
  `Object.keys(d.lessons).length` — more lessons only helps); XP, missions, daily, themes,
  `seedHistory` (writes world-1 ids only) all work as-is. The header's "stars collected"
  (`KidHome.tsx:115`) can happily become a cross-world sum — it's display-only.

---

## 5. Map/UI implications

The current map is one component with hardcoded geometry: `ISLAND` (single closed path),
`NODES` (9 points in a 1000×460 viewBox), `curveThrough` for the road, inline scenery, and
`LAND_COLORS`. Generalizing:

- **Extract `<IslandMap>`** from `KidHome.tsx` taking
  `{ islandPath, nodes, palette, decor, stops, currentIdx, doneCount, onStop }`. The scenery
  primitives (`Tree`, `Flower`, `CloudPuff`, and `Critter` from `gamekit.tsx`) are already
  components — a `decor` array of placed primitives per world replaces the inline block at
  `KidHome.tsx:170-207`. `curveThrough` and the node rendering loop move in unchanged.
- **Gradient id collision — real bug waiting**: `kwSky`/`kwSea` are document-global SVG ids
  (`KidHome.tsx:131-138`). The moment two island SVGs render (sea chart with mini-islands, or
  world previews), fills resolve to the *first* DOM instance. Suffix ids per instance
  (`kwSky-w2`) or hoist shared defs.
- **Palette as data**: per-world `{ landColors: string[9], grass, sand, skyStops, seaStops,
  roadFill }`. Night world = same geometry, new palette + a `stars`/`moon` decor set. The road
  classes (`.kwm-road*`, `src/styles/app.css:356-358`) hardcode sand/cream/orange — move those
  three colors to inline styles or CSS vars set on the `.kw-map` wrapper. Reduced-motion is
  already handled globally (`app.css:654`).
- **Sea chart view**: same 1000×460 viewBox, islands as scaled-down silhouettes (reuse each
  world's `islandPath` inside a `<g transform="scale(0.22)">`), the existing boat promoted to
  the traveller marker, dotted sea-routes via the same `curveThrough` between island anchor
  points. Locked worlds render as fog-grey silhouettes with a `?` — the exact visual grammar
  the locked node already uses (`kw-node-locked`). This is a *view state* of KidHome (zoomed
  out ⇄ zoomed in), not a new route — kid nav stays 4 items (`KID_NAV`, `Shell.tsx:44`).
- **Guardians**: `PIXEL_PALS` has 4 pals cycled across 9 stops via `i % PIXEL_PALS.length`
  (`KidHome.tsx:220`). Worlds want per-world casts — either extend `PIXEL_PALS` (presets exist
  in `avatars.tsx` past `ANIMAL_START`) or make the pal list a world property. Cheap, high
  charm-per-line.
- **Accessibility**: the map's `aria-label` sentence (`KidHome.tsx:128`) and per-node labels
  already parameterize cleanly; the sea chart needs the same treatment ("World map: 2 of 3
  islands…").

---

## 6. Phased plan (each phase ships alone)

**Phase 1 — Finish the finish** *(one session, no migration)*
- Fire `celebrate({ kind: 'level', … })` when the 9th land completes (the hook and the
  `useUi.celebrate` machinery already exist — graduation uses it at `KidHome.tsx:342`).
- World-complete map state: flag/crown on the castle, banner chip ("Island explored!"),
  small decor upgrade on 3-starred stops (the `kw-star` marker at `KidHome.tsx:244` already
  distinguishes done — add a per-stop 3-star crown variant).
- Better pass-2 quest copy: when polishing, say so — "Earn 3 stars in Skyreach Ridge" with
  current star count, instead of presenting the same lesson title as if new.
- Value: the current anticlimax is fixed even if nothing else ever ships.

**Phase 2 — The Second Quest (night island)** *(1–2 sessions)*
- `WORLDS` registry + `w2-` lesson ids + `kidWorlds` field + store version 4 (§4).
- Remix knobs in `buildLessonPlan` (target multiplier, longer lines, harder pool notch).
- Night palette + star/firefly decor on the same `ISLAND`/`NODES`; unlocks when all 9 lands
  are explored (≥1 star each), not 3-starred — 3-starring *is* the night quest's job.
- Value: a real World 2 with zero authored content.

**Phase 3 — The sea chart** *(1–2 sessions)*
- Extract `<IslandMap>`, fix gradient ids, add the zoomed-out chart with boat travel between
  World 1 and the night island; locked-world fog silhouettes tease what's next.
- Value: the scaling architecture exists; every later world is content-only.

**Phase 4 — First authored island + special isles** *(2–3 sessions, incremental)*
- World 3 "Cipher Isles": stop list + palettes + `KID_CODE_LINES`/extra kid sentence pools,
  lessons built from existing `numbers`/`symbols`/`punct` generators and `buildModeText`
  modes (`dictation`, `blind`, `recovery` are kid-viable and unused by the curriculum today).
- Boss lighthouse isle (daily challenge + expert CPU race) and the weekly Drifting Isle
  (weak-key isle over `weakKeys`/`buildWeakKeyWorkout`) as chart decorations.
- Value: the archipelago is real; the chart has non-curriculum life between islands.

**Deliberately not planned**: endless procedural worlds (no collection value, §2C), and any
change to graduation thresholds — the exit ramp stays exactly where it is.
