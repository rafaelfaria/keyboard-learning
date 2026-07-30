# KeyTopia — every keyboard is a world

An original typing-learning platform: part school, part personal coach, part arcade, part
long-term skill tracker. Built as a fully working local-first prototype — no backend, no
accounts, everything persists in the browser.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build (tsc + vite)
npm run preview
```

## What's inside

| Area | Where | Notes |
|---|---|---|
| Landing (GSAP + Three.js) | `src/pages/Landing.tsx`, `landing3d.ts` | Scroll-driven camera + keyboard→terrain morph, live type-anywhere hero |
| Typing engine | `src/components/typing.tsx` | Keystroke capture, WPM/raw/accuracy, consistency, rhythm, hesitations, per-key & per-pair timing, replay timelines |
| Adaptive engine | `src/lib/adaptive.ts` | Key mastery states, weak-key scoring, generated practice with "why this set" explanations |
| Curriculum | `src/lib/curriculum.ts` | 9 regions ("the Atlas"), ~37 lessons, layout-aware (QWERTY/QWERTZ/AZERTY/Dvorak/Colemak), star mastery checks |
| Modes | `src/pages/TrainSession.tsx` | Adaptive, weak-key, sprints (15s–5m), Accuracy Lab, rhythm metronome, zen, endurance, real-world, code, numbers, dictation (speech), copy desk, blind keyboard, recovery |
| Games (7) | `WordfallGame` `KeyforgeGame` `WordflightGame` `DuelGame` `CipherGame` `StackGame` `SurvivorGame` | Each trains a named skill; Quill Duel & Survivor Sprint are competitive head-to-head formats |
| Racing | `RaceHub.tsx`, `RaceLive.tsx` | CPU racers with personalities, adaptive difficulty, ghost of your best run, simulated private rooms with join codes |
| Progression | `src/lib/store.ts`, `badges.ts`, `challenge.ts` | XP/levels, 39 badges, streaks, weekly missions, seeded daily challenge with age divisions |
| Analytics | `src/pages/Progress.tsx`, `charts.tsx` | Speed/accuracy charts, practice calendar, keyboard heatmaps, finger/hand analysis, rhythm fingerprint, session echo replay |
| Coach ("Kip") | `src/lib/coach.ts` | Rule-based, data-specific insights in five personalities |
| Themes & a11y | `themes.ts`, `base.css`, Settings | 12 full themes (level-unlocked), font scaling, Atkinson Hyperlegible, reduced motion, untimed mode, spoken targets, hideable leaderboards |
| Family & schools | `src/pages/Family.tsx` | Guardian summary from real data + teacher dashboard concept |
| Kid World | `src/pages/KidHome.tsx` | Island-map home for kids with quests, stickers and a graduation path to the full dashboard |
| Brand & icons | `src/components/Brand.tsx`, `public/*.svg`, `scripts/gen-icons.mjs` | Vector logo mark (orbit + keycap + spark); `npm run icons` rasterises every favicon, PWA icon, .ico and the 1200×630 social card |
| Accounts | `src/lib/auth.ts`, `src/pages/ProfilePicker.tsx` | Log out → "Who's typing?" picker. All sign-in/out goes through the `auth` adapter, so a real backend swaps in by editing that one file |
| Icons & avatars | `src/components/icons.tsx`, `avatars.tsx` | lucide icon system + Minecraft-style block avatars (level-unlocked presets) |

All lesson content, sentences, paragraphs and names are original. Data lives in
`localStorage` under `keytopia-v1`; sample history seeded after the placement test can be
removed in Settings → Data.
