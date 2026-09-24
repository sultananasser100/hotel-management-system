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

## Phase 3 — Auth.js setup with role-based access

**Goal:** working login/logout against the seeded users, JWT sessions carrying role, an optimistic
route-protection layer, and an authoritative server-side check — no Phase 4 UI shell yet.

**What was done:**

- Installed `next-auth@5.0.0-beta.32` (exact pin) — its peer deps explicitly support Next 16.3.5 /
  React 19.2.8; no adapter package needed (Credentials + JWT doesn't persist sessions to the DB,
  so no schema changes).
- `src/lib/auth.ts` — NextAuth config: `Credentials` provider (`authorize()` checks `isActive`,
  verifies password with `bcrypt.compare`, updates `lastLoginAt`), `session: { strategy: "jwt" }`,
  `jwt`/`session` callbacks carrying `id`/`role` onto the token/session, and an `authorized`
  callback that redirects unauthenticated users to `/login`, authenticated users away from
  `/login`, and non-matching roles away from role-only route prefixes.
- `src/lib/permissions.ts` — the role/resource matrix from the architecture plan, plus
  `ROLE_ONLY_ROUTE_PREFIXES` (currently `/staff`, `/settings` → `ADMIN`).
- `src/lib/session.ts` — `requireUser()`/`requireRole()`, the authoritative server-side check for
  Server Components/Actions/Route Handlers (per Next.js's own recommended DAL pattern).
- `src/types/next-auth.d.ts` — module augmentation adding `id`/`role` to `Session`/`User`/`JWT`.
- `src/app/api/auth/[...nextauth]/route.ts`, `src/lib/actions/auth.ts` (`loginAction`,
  `logoutAction`), `src/app/(auth)/login/{page,login-form}.tsx`,
  `src/app/(dashboard)/dashboard/page.tsx` (intentionally minimal placeholder), `src/app/page.tsx`
  now redirects to `/dashboard`.
- `src/proxy.ts` — Next.js 16's `middleware.ts` successor; just re-exports the wrapped `auth`
  function as `proxy`, all logic lives in the `authorized` callback above.

**Real issues found and fixed (see `DECISIONS.md`):** Auth.js's documented JWT type-augmentation
target (`next-auth/jwt`) doesn't actually type-check against this beta version's callback
signatures — traced it to `@auth/core/jwt` instead; `npx auth secret` resolves to an unrelated npm
package; the `lastLoginAt` update was originally fire-and-forget and silently never completed,
fixed by awaiting it.

**Verification:** `tsc --noEmit`, `npm run lint`, `npm run build` all pass. Full auth flow tested
against the running dev server and real seeded users via direct HTTP calls to the Auth.js
endpoints (which `loginAction`/`logoutAction` thinly wrap): wrong password and unknown email both
rejected with the same generic error (no user-enumeration signal); correct admin login succeeds,
sets a session cookie, and updates `lastLoginAt` in the database; `/dashboard` shows the correct
signed-in name/role for both an admin and a housekeeping account; a housekeeping session hitting
`/staff` is redirected to `/dashboard` while an admin session is allowed through (404s only because
the page doesn't exist yet); an authenticated session visiting `/login` is redirected to
`/dashboard`; sign-out clears the session cookie and subsequent `/dashboard` access redirects to
`/login`.

**Not done in this phase (by design):** no Playwright browser-level test of the login form itself
yet (that's Phase 15) — verification here exercised the underlying Auth.js endpoints directly. No
`/staff` or `/settings` pages exist yet (later phases); the role-only route list in
`permissions.ts` is forward-looking infrastructure, demonstrated via the proxy redirect test above.

## Phase 4 — Application shell (sidebar, header, navigation)

**Goal:** replace the Phase 3 placeholder dashboard with the real shell — sidebar, header, user
menu, role-aware nav — without building any actual feature pages.

**What was done:**

- Added shadcn's `sidebar` block (pulls in `sheet`, `tooltip`, `skeleton`, and a `use-mobile` hook
  — all source components, zero new npm dependencies; confirmed via `shadcn view sidebar` before
  installing). Declined to overwrite the 3 already-customized files it also touches
  (`button`, `separator`, `input`).
- `src/lib/nav.ts` — the 12-item nav structure, each entry tagged with its `Resource` from
  `permissions.ts` so visibility can never drift from the permission matrix.
- `src/components/layout/app-sidebar.tsx`, `site-header.tsx`, `user-menu.tsx` — the shell chrome.
  Nav items are filtered with the existing `can(role, resource, "view")`; no new permission logic.
- `src/lib/session.ts` gained `requirePermission(resource, action?)`, a thin composition over the
  existing `requireUser()`/`can()` — used by every placeholder page below so role restrictions are
  enforced authoritatively server-side, not just by hiding the nav link.
- `src/app/(dashboard)/layout.tsx` — the shared shell (`SidebarProvider` + `AppSidebar` +
  `SidebarInset` + `SiteHeader`), reading the `sidebar_state` cookie server-side so the
  expanded/collapsed state is correct on first paint.
- 10 placeholder pages (`rooms`, `room-types`, `guests`, `reservations`, `checkin-checkout`,
  `payments`, `housekeeping`, `staff`, `reports`, `notifications`, `settings`) using a shared
  `<PlaceholderPage>` component — no feature logic, just proves every visible nav link resolves.
- `src/app/(dashboard)/dashboard/page.tsx` trimmed to a minimal welcome message (identity/sign-out
  now live in the header's user menu). Root `layout.tsx` got real metadata, a global `<Toaster />`,
  and `<TooltipProvider>` (required by the sidebar's collapsed-state tooltips).

**Real issue found and fixed (see `DECISIONS.md`):** a Client Component transitively importing
`Role` from the generated Prisma client's main module (rather than its lightweight `enums.ts`)
broke the production build entirely — Turbopack tried to bundle Prisma's Node-only runtime for the
browser. Fixed across all 4 affected files.

**Also fixed in passing:** the shadcn-generated `use-mobile.ts` hook violated
`react-hooks/set-state-in-effect` (calls `setState` synchronously inside a `useEffect` body) —
rewritten to use a lazy `useState` initializer instead, since it's now our own copied/owned code
per the Phase 1 decision to vendor shadcn components rather than depend on them as a package.

**Verification:** `tsc --noEmit`, `npm run lint`, `npm run build` all pass. Manually tested against
the dev server with all 3 seeded roles: ADMIN sees all 12 nav items, RECEPTIONIST sees 10 (no
Staff/Settings), HOUSEKEEPING sees 4 (Dashboard/Rooms/Housekeeping/Notifications) — exact match to
the permission matrix. `/login` renders with zero sidebar/`SidebarProvider` markup. Unauthenticated
`/guests` redirects to `/login`; a HOUSEKEEPING session hitting `/guests` (not proxy-restricted,
only page-level `requirePermission` covers it) redirects to `/dashboard` — confirmed via the
`NEXT_REDIRECT` stack trace naming `requirePermission`/`GuestsPage`, proving the authoritative
check (not just nav-hiding) is what caught it. ADMIN now gets real 200 pages at `/staff` and
`/settings` (were 404 in Phase 3); RECEPTIONIST/HOUSEKEEPING get redirected before reaching them.
Sign-out was re-verified against the new call site specifically (a `DropdownMenuItem onSelect`
calling the Server Action directly, not a form) by extracting its action ID from Next's
server-reference manifest and invoking it directly — confirmed session cookie cleared and the
`x-action-redirect` to `/login` issued.

**Not done in this phase (by design):** no actual Rooms/Guests/Reservations/etc. functionality —
all 10 non-dashboard pages are placeholders per the approved scope. Theme toggle deferred to
Phase 17 per the earlier decision.

---

_Phases 5–14 were written up retroactively during Phase 15, from the source code and commit
history. Per-phase verification details weren't recorded in this log at the time, so none are
claimed for these entries._

## Phase 5 — Dashboard

**Goal:** replace the welcome placeholder with a real hotel overview.

**What was done:**

- `src/lib/dashboard.ts` — `getDashboardData()`: room counts by status, reservation counts by
  status, today's arrivals and departures (CONFIRMED or CHECKED_IN, so a guest who already checked
  in today still appears), recent activity.
- `src/components/dashboard/` — summary cards, occupancy overview (stacked bar built from plain
  Tailwind divs), reservations-by-status, arrivals/departures lists, recent activity feed with
  relative timestamps.

## Phase 6 — Rooms & Room Types

**Goal:** real room and room-type management in place of the placeholders.

**What was done:**

- `/room-types` and `/rooms` pages with tables and create/edit dialogs; ADMIN manages, other roles
  with access view only (`roomTypes`/`rooms` in the permission matrix).
- Server Actions in `src/lib/actions/room-types.ts` and `rooms.ts`. A room type can't be deleted
  while rooms still use it (with a foreign-key safety net that never shows the raw database
  error). Rooms are deactivated/restored rather than deleted, and deactivation is blocked while
  upcoming or current reservations are assigned to the room.

## Phase 7 — Guests

**Goal:** guest directory and guest detail view.

**What was done:**

- `/guests` with search, pagination, and a create/edit dialog (nationality from a fixed country
  list in `src/lib/countries.ts`); `/guests/[id]` detail page with reservation history.
- Guests are never hard-deleted — reservations reference them (`ON DELETE RESTRICT`) and stay
  history should be kept — so "delete" deactivates and can be restored.

## Phase 8 — Reservations

**Goal:** create, edit, and manage bookings with correct availability.

**What was done:**

- `/reservations` list (status, check-in date range, and text filters; pagination), detail page,
  and a create/edit form with a guest picker (`api/guests/search`) and a live availability/price
  check (`api/reservations/availability`).
- `src/lib/availability.ts` — per-night availability for a room type: PENDING/CONFIRMED/CHECKED_IN
  reservations hold a room; MAINTENANCE/OUT_OF_SERVICE and inactive rooms aren't bookable;
  same-day turnover is allowed. Stays are capped at 30 nights.
- Confirmation codes are sequential (`HV-1000`, …), with the unique index catching two bookings
  racing for the same code.
- Confirm / cancel / no-show actions; only PENDING and CONFIRMED reservations are editable.
- Concurrent bookings of the same room type are serialized with a row lock taken inside the
  transaction (`src/lib/room-type-lock.ts`). The stronger database exclusion constraint remains
  deferred to hardening.

## Phase 9 — Check-in / Check-out

**Goal:** the front desk workflow.

**What was done:**

- `/checkin-checkout` front desk board: confirmed arrivals, pending (unconfirmed) arrivals, and
  in-house guests, including how late an arrival or departure is.
- Check-in and check-out dialogs, loading their data from `api/reservations/[id]/front-desk-info`.
  Check-in enforces status and date rules (`src/lib/front-desk-rules.ts`), requires the guest's ID
  document (captured at check-in if not already on file), and warns when the room isn't clean.
- Check-out frees the room (never overwriting a manual MAINTENANCE/OUT_OF_SERVICE status), marks
  it for housekeeping, queues a pending cleaning task, and warns — but doesn't block — on an
  unpaid balance. Both take the same room-type lock as bookings.

## Phase 10 — Payments

**Goal:** payment recording and a reliable balance per reservation.

**What was done:**

- `src/lib/payment-balance.ts` — the single balance calculation, done in whole cents (states:
  none, unpaid, partial, paid, overpaid, refundable).
- Record-payment dialog in the reservation page's payments section (the check-out dialog links
  to it when a balance is outstanding); `/payments` list with filters.
- Mark a pending payment received; ADMIN-only void (stored as FAILED, excluded from the balance)
  and refund. Payment rows are never deleted or edited.
- Payment changes are serialized per reservation (`src/lib/reservation-lock.ts`), a lock that
  can't deadlock with the room-type lock.

## Phase 11 — Housekeeping

**Goal:** a housekeeping board for cleaning status and task assignment.

**What was done:**

- `/housekeeping` board with summary counts and filters (status or "needs attention", floor,
  assignee), plus a per-room history dialog (`api/housekeeping/rooms/[id]/history`).
- Status changes keep the room's housekeeping status and its CLEANING task in step (DIRTY ↔
  PENDING, IN_PROGRESS ↔ IN_PROGRESS, CLEAN ↔ COMPLETED, INSPECTED ↔ VERIFIED); whoever starts a
  cleaning becomes its assignee. Housekeeper assignment for rooms with cleaning to do.
- Changes are serialized per room (`src/lib/room-lock.ts`), which can't deadlock with bookings or
  check-outs.

## Phase 12 — Notifications

**Goal:** in-app notifications for events staff need to act on.

**What was done:**

- `src/lib/notifications.ts` — `notifyRole()` / `notifyUser()`, called inside the originating
  feature's transaction right after its `ActivityLog` write, so a rolled-back change never leaves
  a stray notification.
- Events: check-out → HOUSEKEEPING (room needs cleaning); housekeeper assignment → the assigned
  user; payment recorded or marked received → ADMIN; reservation cancelled or marked no-show →
  ADMIN.
- Header notification bell (latest 10) and `/notifications` page (paginated); mark one or all as
  read.

## Phase 13 — Reports

**Goal:** a reports dashboard over a selectable date range.

**What was done:**

- `src/lib/reports.ts` — revenue (received/refunded/outstanding, by method, trend), occupancy
  (rate and trend), reservations (status breakdown, arrivals, departures), guests (totals, new vs
  returning, nationality breakdown), and housekeeping (completed/open, by type, by priority).
- `/reports` with a date-range filter defaulting to the last 30 days; time series switch from
  daily to weekly buckets for ranges over 60 days.
- Charts are built from plain Tailwind divs (`src/components/reports/bar-chart.tsx`) — no charting
  library is installed.

## Phase 14 — AI Hotel Assistant

**Goal:** a read-only assistant that answers staff questions from live hotel data.

**What was done:**

- Google Gemini via `@google/genai` (`src/lib/assistant/client.ts`), configured by
  `GEMINI_API_KEY` / `GEMINI_MODEL`. With no key, the assistant reports that it isn't configured
  instead of failing.
- `src/lib/assistant/tools.ts` — 11 read-only tools, each wrapping an existing `src/lib/*` read
  function and re-checking `can(role, resource, "view")`; list results are capped, and guest tools
  exclude identity documents and notes.
- `src/lib/assistant/run-assistant.ts` — function-calling loop capped at 5 round trips, with one
  retry on a Gemini 503. `src/lib/assistant/system-prompt.ts` restricts the model to tool-backed
  answers and tells it to refuse actions.
- `api/assistant/chat` Route Handler (session, role, and message-size validation; errors mapped
  to user-facing messages) and the `/assistant` chat page, available to ADMIN and RECEPTIONIST.
  Chat history lives only in the browser session.
- Model choice: `.env.example` records that `gemini-3.7-flash` returned frequent 503 "overloaded"
  errors on the free tier during testing and `gemini-3.5-flash` was more reliable.

## Phase 15 — Production readiness & deployment (in progress)

**Goal:** prepare for the first deployment (Vercel + hosted PostgreSQL). Nothing is deployed yet.

**What was done so far:**

- Production-readiness review of database, env vars, auth, Gemini, Next.js/Vercel compatibility,
  security, and docs. Main blocker found: the generated Prisma Client (`src/generated/prisma`) is
  gitignored and nothing regenerated it on a fresh install, so a Vercel build would fail.
- Added `"postinstall": "prisma generate"` and `"db:deploy": "prisma migrate deploy"` to
  `package.json`; `build` and `db:migrate` unchanged.
- Config cleanup: removed obsolete Anthropic variables from the local `.env` and fixed its stale
  `npx auth secret` comment; aligned the code's default `GEMINI_MODEL` with `.env.example`
  (`gemini-3.5-flash`, the model already in use); clarified `.env.example`.
- Documentation: rewrote `README.md` (current stack, features, setup, env vars, Prisma, scripts, a
  deployment section) and corrected `ARCHITECTURE.md` (Gemini instead of Anthropic; removed the
  never-implemented "proposed action" confirmation flow; documented the assistant's read-only tool
  boundary, database/migrations setup, and locking).
- Seed changes before seeding the hosted database: all 5 seeded accounts now use the demo password
  `Harborview-Demo-2026!` (replacing Phase 2's `Password123!`, which databases seeded earlier still
  have, since the seed never updates existing users). Only `admin@hotel.test` is documented as the
  public demo account, and the seed prints only that account. Also fixed the seeded `COMPLETE_TASK`
  activity-log entry, which referenced room 302's id instead of the completed housekeeping task's
  id (tasks are now created with `createManyAndReturn`).

**Verification:** after deleting `src/generated/prisma` and `.next`, `npm ci` ran the new
`postinstall` and regenerated the client from `prisma7.config.ts`; `npm run build` passed.
`prisma generate` also succeeds with no `DATABASE_URL` set. `prisma migrate deploy` was confirmed
to exist and read `prisma7.config.ts` (help output only — no migrations were run).

**Known issues, not addressed yet:** `npm run format:check` fails across the local checkout
because files have CRLF line endings while Prettier expects LF; `npm ci` reports 4 high-severity
dependency vulnerabilities (not yet investigated).
