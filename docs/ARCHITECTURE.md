# Architecture

## Overview

Next.js (App Router) is used as the full-stack framework — no separate API server. Server
Components fetch data directly via Prisma; Server Actions handle form mutations; Route Handlers
are used where a real HTTP endpoint is required: Auth.js (`api/auth/[...nextauth]`), the AI
assistant's chat endpoint (`api/assistant/chat`, returns one JSON reply per request — not
streamed), and a few read-only lookups that Client Components call while a dialog or form is open
(`api/reservations/availability`, `api/guests/search`, `api/reservations/[id]/front-desk-info`,
`api/housekeeping/rooms/[id]/history`) — Server Actions are dispatched one at a time, so reads go
through Route Handlers instead. Every Route Handler checks the session and `can()` itself.

## Key decisions

- **Framework version:** whatever `create-next-app@latest` resolved to at project init
  (Next.js 16 at the time of writing) — not pinned to a specific major ahead of time. Next.js 16
  has real breaking changes from older docs/training data (e.g. `middleware.ts` deprecated in
  favor of `proxy.ts`), so framework-specific patterns are verified against the docs bundled in
  `node_modules/next/dist/docs/` (or currently official docs) before use, each time they come up.
- **Styling/UI:** Tailwind CSS v4 (CSS-based config, no `tailwind.config.js`) + shadcn/ui
  (Radix-based components copied into `src/components/ui`, not an installed black-box dependency).
- **Auth:** Auth.js (NextAuth v5, pinned `5.0.0-beta.32`), Credentials provider, JWT sessions,
  role embedded in the session/token (`src/lib/auth.ts`). No adapter/DB tables — Credentials +
  JWT doesn't persist sessions. `src/proxy.ts` (Next.js 16's `middleware.ts` successor) does
  optimistic redirects only, via the `authorized` callback; `src/lib/session.ts`'s
  `requireUser()`/`requireRole()` are the authoritative server-side check, per Next.js's own
  recommended DAL pattern. The role matrix itself lives in `src/lib/permissions.ts` (`can()`).
  The role is read from the JWT, not re-checked against the database on each request, so a role
  change or deactivation takes effect at the user's next sign-in. Introduced in Phase 3.
- **Database:** PostgreSQL + Prisma 7 (pinned exact version, not `@latest` — see `DECISIONS.md`).
  Local dev via `docker-compose.yml`; production on a hosted Postgres (Neon) with the app
  deployed on Vercel. Prisma 7's default generator has no bundled query engine, so the
  client connects through an explicit `@prisma/adapter-pg` driver adapter (`src/lib/prisma.ts`)
  rather than a bare `new PrismaClient()`. Connection URL and seed command live in
  `prisma7.config.ts`. The generated client (`src/generated/prisma`) is gitignored and produced by
  `prisma generate`, which runs on every `npm install` via `postinstall`. Migrations are applied
  with `prisma migrate dev` locally and `prisma migrate deploy` (`npm run db:deploy`) in
  production. Introduced in Phase 2.
- **Data integrity under concurrency:** mutations run in Prisma transactions that take a
  PostgreSQL row lock before validating and writing — per room type for bookings, check-ins and
  check-outs (`room-type-lock.ts`), per reservation for payments (`reservation-lock.ts`), per room
  for housekeeping (`room-lock.ts`). The lock ordering is chosen so these can't deadlock with each
  other. A database exclusion constraint against double-booking is deferred to hardening.
  Reservation, check-in/out, payment, and housekeeping changes write an `ActivityLog` row, and
  notifications are created inside the same transaction
  (`src/lib/notifications.ts`), so a rolled-back change never leaves a stray notification.
- **AI assistant:** Google Gemini via `@google/genai`, configured by `GEMINI_API_KEY` and
  `GEMINI_MODEL` (`src/lib/assistant/client.ts`, server-only). Available to ADMIN and RECEPTIONIST
  (`aiAssistant` in the permission matrix). The browser posts the chat history to
  `api/assistant/chat` (no server-side conversation storage); the route validates the session,
  role, and message sizes, then `run-assistant.ts` runs a bounded function-calling loop (at most 5
  model round trips, one retry on a 503) and returns the final text. The model can only call the
  fixed tools in `src/lib/assistant/tools.ts`, each of which wraps an existing read function from
  `src/lib/*` (dashboard, front desk, reservations, availability, rooms, housekeeping, guests,
  payments, reports) and re-checks `can(role, resource, "view")` before running. **The assistant
  is read-only**: no tool writes to the database, and there is no mechanism for the model to
  propose or perform changes — for actions, it points the user to the relevant page. List results
  are capped in size, and the guest tools exclude identity documents and free-text notes. Introduced in
  Phase 14.
- **Application shell:** shadcn's `sidebar` block (`src/components/ui/sidebar.tsx`) wrapping
  `src/app/(dashboard)/layout.tsx`; nav items (`src/lib/nav.ts`) are filtered with the same
  `can()` used everywhere else, and every page under `(dashboard)` also calls
  `requirePermission()`/`requireRole()` itself — the sidebar hiding a link is a UX nicety, never
  the actual access control. Prisma enums used by Client Components (e.g. the sidebar) must import
  from `@/generated/prisma/enums`, never `@/generated/prisma/client` — see `DECISIONS.md`.
  Introduced in Phase 4.

## Full plan

The complete architecture proposal — folder structure, database/entity design, role/permission
model, feature breakdown, phased development plan, dependency list, and technical risks — was
reviewed and approved before implementation began. See `DECISIONS.md` for the running log of
decisions made or revisited during implementation.
