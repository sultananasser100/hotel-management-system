# Hotel Management System

A full-stack Hotel Management System for a small-to-medium hotel, built as a portfolio project
and as an experiment in AI-assisted development with Claude Code. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the architecture and
[docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md) for the phase-by-phase build record.

## Tech stack

- Next.js (App Router) + TypeScript, React Server Components
- Tailwind CSS + shadcn/ui
- PostgreSQL + Prisma
- Auth.js (NextAuth v5), role-based access (Admin / Receptionist / Housekeeping)
- Zod validation, Recharts, Vitest, Playwright
- Claude API (`@anthropic-ai/sdk`) for the in-app AI assistant

## Getting started

Prerequisites: Node.js 20+, Docker Desktop (for local Postgres).

```bash
# 1. Install dependencies
npm install

# 2. Start local Postgres
docker compose up -d

# 3. Copy env vars and fill in secrets
cp .env.example .env

# 4. Apply the database schema and load demo data
npm run db:migrate
npm run db:seed

# 5. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo accounts (all use password `Password123!`): `admin@hotel.test` (Admin),
`receptionist@hotel.test` / `bob.reception@hotel.test` (Receptionist),
`housekeeping@hotel.test` / `dan.housekeeping@hotel.test` (Housekeeping). Note: sign-in isn't
implemented until Phase 3 — these accounts exist in the database now so they're ready to use once
auth lands.

## Scripts

- `npm run dev` — start the dev server (Turbopack)
- `npm run build` / `npm run start` — production build/serve
- `npm run lint` — ESLint
- `npm run format` / `npm run format:check` — Prettier
- `npm run db:migrate` — apply Prisma migrations (dev)
- `npm run db:seed` — load demo data
- `npm run db:studio` — browse the database in Prisma Studio
