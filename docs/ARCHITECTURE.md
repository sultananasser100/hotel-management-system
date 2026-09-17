# Architecture

## Overview

Next.js (App Router) is used as the full-stack framework — no separate API server. Server
Components fetch data directly via Prisma; Server Actions handle form mutations; Route Handlers
are used only where a real HTTP endpoint is required (Auth.js, the AI assistant's streaming
endpoint).

## Key decisions

- **Framework version:** whatever `create-next-app@latest` resolved to at project init
  (Next.js 16 at the time of writing) — not pinned to a specific major ahead of time. Next.js 16
  has real breaking changes from older docs/training data (e.g. `middleware.ts` deprecated in
  favor of `proxy.ts`), so framework-specific patterns are verified against the docs bundled in
  `node_modules/next/dist/docs/` (or currently official docs) before use, each time they come up.
- **Styling/UI:** Tailwind CSS v4 (CSS-based config, no `tailwind.config.js`) + shadcn/ui
  (Radix-based components copied into `src/components/ui`, not an installed black-box dependency).
- **Auth:** Auth.js (NextAuth v5), Credentials provider, JWT sessions, role embedded in the
  session. Introduced in Phase 3.
- **Database:** PostgreSQL + Prisma 7 (pinned exact version, not `@latest` — see `DECISIONS.md`).
  Local dev via `docker-compose.yml`; production via a hosted Postgres (Neon) on Vercel. Prisma
  7's default generator has no bundled query engine, so the client connects through an explicit
  `@prisma/adapter-pg` driver adapter (`src/lib/prisma.ts`) rather than a bare `new PrismaClient()`.
  Introduced in Phase 2.
- **AI assistant:** direct `@anthropic-ai/sdk` usage with a read-only tool set — the model never
  has a tool that writes to the database. Any mutating request becomes a structured "proposed
  action" that the UI shows as a confirmation dialog; confirming it calls the same Server Action
  the manual UI uses. Introduced in Phase 14.

## Full plan

The complete architecture proposal — folder structure, database/entity design, role/permission
model, feature breakdown, phased development plan, dependency list, and technical risks — was
reviewed and approved before implementation began. See `DECISIONS.md` for the running log of
decisions made or revisited during implementation.
