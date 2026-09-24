# Hotel Management System

A full-stack Hotel Management System for a small-to-medium hotel, built as a portfolio project
and as an experiment in AI-assisted development with Claude Code. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the architecture and
[docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md) for the phase-by-phase build record.

## Tech stack

- Next.js 16 (App Router) + TypeScript + React 19 — Server Components for reads, Server Actions for
  mutations, a few Route Handlers for client-side lookups
- Tailwind CSS v4 + shadcn/ui (Radix-based components copied into `src/components/ui`)
- PostgreSQL + Prisma 7 (`@prisma/adapter-pg` driver adapter)
- Auth.js (NextAuth v5) — Credentials provider, JWT sessions
- Google Gemini (`@google/genai`) for the in-app AI assistant
- ESLint + Prettier

## Features

- **Authentication and roles** — email/password sign-in with three roles: **Admin**,
  **Receptionist**, and **Housekeeping**. Every page, Server Action, and Route Handler checks
  permissions server-side against one permission matrix (`src/lib/permissions.ts`); the sidebar
  only shows what the signed-in role can access.
- **Dashboard** — room and reservation status overview, today's arrivals and departures, recent
  activity.
- **Rooms and room types** — manage room types (price, occupancy, amenities) and rooms (floor,
  status, housekeeping status). Rooms are deactivated rather than deleted.
- **Guests** — searchable guest directory, guest detail page with reservation history,
  deactivate/restore instead of hard delete.
- **Reservations** — create and edit bookings with a live availability and price check,
  confirm/cancel/no-show actions, filtering and pagination.
- **Check-in / check-out** — front desk board of arrivals, pending arrivals, and in-house guests.
  Check-out frees the room and queues a cleaning task for housekeeping.
- **Payments** — record payments against a reservation with a running balance; mark pending
  payments received; Admin-only void and refund. Payment rows are never deleted or edited.
- **Housekeeping** — per-room cleaning board with status changes, housekeeper assignment, and
  per-room history.
- **Notifications** — in-app notifications (header bell and a notifications page) for events such
  as check-outs needing cleaning, task assignments, and payment changes.
- **Reports** — revenue, occupancy, reservations, guests, and housekeeping reports over a
  selectable date range.
- **AI hotel assistant** (Admin and Receptionist) — a chat page that answers questions about the
  hotel's data using Gemini. It is **read-only**: it can only call a fixed set of lookup tools and
  cannot change anything.

The **Staff** and **Settings** pages (Admin only) are placeholders and not yet implemented.

## Local setup

Prerequisites: Node.js 20.19+ (or 22.12+ / 24+, per Prisma 7's requirements), Docker Desktop (for
local PostgreSQL).

```bash
# 1. Install dependencies (also runs `prisma generate` via the postinstall script)
npm install

# 2. Create your local env file and fill in the values (see "Environment variables" below)
cp .env.example .env

# 3. Start local PostgreSQL
docker compose up -d

# 4. Apply the database migrations and load demo data
npm run db:migrate
npm run db:seed

# 5. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo account:** `admin@hotel.test` / `Harborview-Demo-2026!`

This is a **public demo account with full ADMIN permissions** — anyone with this README can sign
in with it and view or change all demo data. Don't enter real or private information (real guest
details, payment data, personal contact info). The seed also creates additional receptionist and
housekeeping staff accounts that populate the demo data; their credentials are not published.
Databases seeded before this demo password was introduced keep their original passwords — the
seed never updates existing users.

The seed script is meant to run once against an empty database — running it a second time fails
on unique constraints (e.g. room numbers). To start over locally, reset the database first (for
example `npx prisma migrate reset`, which drops all data).

## Environment variables

See [.env.example](.env.example) for the template. All variables are server-side only — none use
the `NEXT_PUBLIC_` prefix, and none should.

| Variable         | Secret | Purpose                                                                                                |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`   | Yes    | PostgreSQL connection string (local Docker database in development)                                    |
| `AUTH_SECRET`    | Yes    | Signs/encrypts Auth.js session tokens. Generate a random value (command in `.env.example`)             |
| `GEMINI_API_KEY` | Yes    | Google Gemini API key for the AI assistant. Without it, the assistant reports that it isn't configured |
| `GEMINI_MODEL`   | No     | Gemini model id. Optional; defaults to `gemini-3.5-flash`                                              |

`.env` is gitignored. Never commit real values.

## Database and Prisma

- Schema: `prisma/schema.prisma`. Migrations: `prisma/migrations/`. Seed: `prisma/seed.ts`.
- Prisma config (connection URL, migrations path, seed command) lives in `prisma7.config.ts`, the
  filename Prisma 7.10 looks for first.
- The Prisma Client is generated into `src/generated/prisma/` (gitignored). `npm install` runs
  `prisma generate` automatically; run `npx prisma generate` manually after changing the schema.
- Local PostgreSQL 16 runs via `docker-compose.yml`, with development-only credentials that match
  `.env.example`.

## Scripts

- `npm run dev` — start the dev server (Turbopack)
- `npm run build` / `npm run start` — production build (includes type checking) / serve it
- `npm run lint` — ESLint
- `npm run format` / `npm run format:check` — Prettier
- `npm run db:migrate` — `prisma migrate dev`: apply migrations and create new ones (development
  only)
- `npm run db:deploy` — `prisma migrate deploy`: apply existing migrations only (production)
- `npm run db:seed` — load demo data
- `npm run db:studio` — browse the database in Prisma Studio
- `postinstall` — runs `prisma generate` automatically after every install

To run a production build locally (`npm run build && npm run start`), also set
`AUTH_TRUST_HOST=true` in `.env` — outside of Vercel, Auth.js only trusts the request host
automatically in development mode.

## Deployment

**Status:** deployed. The app runs on **Vercel** with a hosted **PostgreSQL** database (Neon).
Connection strings and other secrets live only in the Vercel project's environment settings.

How it fits together:

1. **Database schema** — production migrations are applied with `npm run db:deploy`
   (`prisma migrate deploy`), which only applies migrations already committed in
   `prisma/migrations/`. Never use `db:migrate` (`prisma migrate dev`) against production — it is
   a development tool that can reset the database. To run `db:deploy` against the hosted database,
   set `DATABASE_URL` to its connection string for that one command (an environment variable that
   is already set takes precedence over `.env`).
2. **Demo data** — seeding production is a one-time operation for the demo environment, run once
   against the empty database after the first migration. Note that the seed creates the public
   ADMIN demo account documented above, so anyone can sign in to the deployed demo with full
   permissions.
3. **Vercel** — Vercel runs `npm install` (which triggers `prisma generate`) and then
   `npm run build`. Configure these environment variables in the Vercel project settings:
   - `DATABASE_URL` — the hosted database's connection string
   - `AUTH_SECRET` — a newly generated value, not the one from local development
   - `GEMINI_API_KEY` — the Gemini API key
   - `GEMINI_MODEL` — the model id (e.g. `gemini-3.5-flash`)

   `AUTH_URL` is not needed on Vercel: Auth.js detects Vercel and trusts its host automatically.

4. **Later schema changes** — create the migration locally with `npm run db:migrate`, commit it,
   and run `npm run db:deploy` against the production database when deploying.

Secrets live only in `.env` (local, gitignored) and in the hosting provider's environment
settings. Never commit them.
