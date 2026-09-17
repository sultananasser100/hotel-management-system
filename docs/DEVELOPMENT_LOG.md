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

## Phase 2 — Database schema & Prisma

**Goal:** a running local Postgres with the full approved schema migrated in, a Prisma Client
singleton the app can use, and realistic seed data — no feature UI yet.

**What was done:**

- Installed pinned `prisma`/`@prisma/client` `7.10.0` (not `@latest`, which currently resolves to
  an 8.0 release candidate — see `DECISIONS.md`), plus `tsx` to run the TS seed script.
- Ran `prisma init`, which — per current Prisma 7 conventions — generated `prisma7.config.ts`
  (connection URL + migrations/seed config) separately from `prisma/schema.prisma`, and set the
  new default `prisma-client` generator with an explicit `output` path
  (`src/generated/prisma`, gitignored).
- Wrote the full schema: `User`, `RoomType`, `Room`, `Guest`, `Reservation`, `Payment`,
  `HousekeepingTask`, `Notification`, `HotelSettings`, `ActivityLog`, with the enums, relations,
  unique constraints, and indexes from the approved design. Ran the first migration
  (`prisma migrate dev --name init`) against the Docker Compose Postgres.
- Hit a real breaking change: Prisma 7's default generator has no bundled query engine and
  requires an explicit driver adapter. Installed `@prisma/adapter-pg` + `pg`, updated
  `src/lib/prisma.ts` (the dev-hot-reload-safe singleton) and `prisma/seed.ts` accordingly — see
  `DECISIONS.md` for the details.
- Wrote `prisma/seed.ts`: 3 room types, 24 rooms across 4 floors (with a few in non-default
  status/housekeeping states), 12 guests, 18 reservations spanning checked-out/checked-in/
  confirmed/pending/cancelled/no-show, payments for most of them, 6 housekeeping tasks in varied
  states, a handful of notifications and activity log entries, one row per role plus an extra
  receptionist and housekeeping staffer (5 users total, all password `Password123!`), and the
  `HotelSettings` singleton row.
- Excluded the generated Prisma Client from ESLint/Prettier (it was being type-aware-linted at
  ~40s per file).

**Verification:** `prisma validate` passes; migration applied cleanly; seed ran and produced the
expected row counts (24 rooms, 18 reservations with the intended status spread, confirmed via
`psql`); a standalone script confirmed `src/lib/prisma.ts`'s singleton queries the real database
correctly; `npm run build` and `npm run lint` both pass.

**Not done in this phase (by design):** the Postgres `EXCLUDE`-constraint-based double-booking
guard is deferred to the hardening phase, per the approved plan — Phase 2 only adds the supporting
indexes.
