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
