# KeyTopia — agent notes

## Dev server: one per machine, always port 50675

Do NOT start a new dev server if one is already running. Multiple parallel
Vite servers eat all available memory on this machine.

- The dev server always lives at `http://localhost:50675` (pinned with
  `strictPort` in vite.config.ts, so a duplicate `npm run dev` fails fast
  instead of hopping ports).
- First, attach to the running server: `preview_start {name: "keytopia"}`
  (an attach-only config, it starts nothing).
- Only if attaching fails because nothing is listening, start one with
  `preview_start {name: "keytopia-fresh"}`.
- Never run `npm run dev` / `vite` via Bash.
- `keytopia-prod` serves the built output on port 4173 (`npm run preview`),
  for verifying prerendered pages only.
