# Development log

This project is built with Claude Code doing the actual implementation work, phase by phase, with
review between phases. This log records what happened in each phase, not a fictionalized "manual"
history. See `DECISIONS.md` for the reasoning behind specific choices.

## Phase 1 — Project setup

**Goal:** a running Next.js app with the base tooling in place; no feature code yet.

**What was done:**

- Scaffolded with `create-next-app@latest` (resolved to Next.js 16.3.5, React 19) — TypeScript,
  Tailwind CSS v4, ESLint, App Router, `src/` directory, `@/*` import alias, Turbopack.
  (Scaffolded into a temp subdirectory first because `create-next-app` rejects package names with
  spaces/capitals — the folder is named "Hotel management system" — then moved into the repo
  root.)
- Initialized shadcn/ui (`radix` base, `nova` preset) and added a baseline set of primitives:
  button, card, badge, table, dialog, input, label, select, dropdown-menu, avatar, separator,
  sonner (toast), tabs, textarea.
- Added Prettier + `eslint-config-prettier` so lint and format don't fight each other.
- Added `docker-compose.yml` for local Postgres (used starting Phase 2) and `.env.example`
  documenting env vars for the database, auth, and AI phases ahead of time.
- Wrote `README.md` and this `docs/` set.

**Verification:** `npm run dev` serves the default page, `npm run build` and `npm run lint` pass
cleanly.

**Notable finding:** Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts` — see
`DECISIONS.md`. Not used yet (auth/routing is Phase 3), but worth knowing ahead of time.
