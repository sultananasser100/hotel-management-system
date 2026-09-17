# Decisions log

Short entries for decisions worth remembering the "why" of. Newest first.

## 2026-09-18 — Client Components must import Prisma enums from `enums.ts`, never `client.ts`

`src/lib/permissions.ts` did `import { Role } from "@/generated/prisma/client"` (a real value import,
used as `Role.ADMIN`). That module also exports the actual `PrismaClient` runtime and imports
`node:process`/`node:path`/`node:url` plus the query engine at its top. Once `app-sidebar.tsx` (a
Client Component) started importing `can()` from `permissions.ts` for nav filtering, Turbopack
tried to bundle that whole module for the browser and hard-failed: `TurbopackInternalError: the
chunking context (unknown) does not support external modules (request: node:module)`. Fixed by
importing `Role` from `@/generated/prisma/enums` instead — a plain-data module the generated
client's own comments say is safe to import directly, with no Node/runtime dependencies. Updated
`permissions.ts`, `session.ts`, `app-sidebar.tsx`, and `types/next-auth.d.ts` (the last two were
`import type`, already erased, but changed for consistency). Rule going forward: any code reachable
from a Client Component may only pull enums from `enums.ts`; only server-only files may import
`@/generated/prisma/client` directly.

## 2026-09-17 — Auth.js `JWT` type augmentation must target `@auth/core/jwt`, not `next-auth/jwt`

Auth.js's own TypeScript docs show augmenting `declare module "next-auth/jwt"` to add custom JWT
fields. In the installed `next-auth@5.0.0-beta.32`, that doesn't type-check: `NextAuthConfig`'s
`session`/`jwt` callbacks type their `token` parameter using `JWT` imported directly from
`@auth/core/jwt` (confirmed in `node_modules/@auth/core/index.d.ts`), and `next-auth/jwt.d.ts`'s
`export * from "@auth/core/jwt"` re-export doesn't make TS treat augmentations to the two module
specifiers as the same interface. `src/types/next-auth.d.ts` augments `@auth/core/jwt` instead —
found by reproducing the actual type error and tracing the import, not by assumption.

## 2026-09-17 — `npx auth secret` is the wrong package

Running it installs and runs an unrelated npm package (`auth@1.7.5`, the "Better Auth" CLI) and
suggests a `BETTER_AUTH_SECRET` var — not an Auth.js/next-auth tool at all, despite the plausible
name. It didn't write anything to `.env` (just printed a suggestion), so no harm done, but the
`.env.example` comment referencing it (carried over from Phase 1 scaffolding) was wrong and is now
fixed to generate the secret via `node -e "console.log(require('crypto').randomBytes(32)...)"`.

## 2026-09-17 — `lastLoginAt` update in `authorize()` must be awaited, not fire-and-forget

Initially written as `void prisma.user.update(...)` to avoid adding latency to sign-in. In testing
against the real dev server, the write never actually landed — the request/response cycle
completed before the un-awaited promise finished. Changed to `await`; verified via `psql` that
`lastLoginAt` now updates correctly. A single indexed update is a few ms; correctness matters more
here than that.

## 2026-09-16 — Prisma 7.10.0 pinned; `prisma` CLI's `latest` tag is actually an 8.0 RC

`npm view prisma dist-tags` showed `prisma`'s `latest` tag pointing at `8.0.0-rc.15` while
`@prisma/client`'s `latest` was still `7.10.0` — the two packages' `latest` tags were on different
majors. Both `prisma` and `@prisma/client` (plus `@prisma/adapter-pg`, which is versioned in
lockstep) are pinned to the exact stable pair `7.10.0`, not whatever `@latest` resolves to.
`prisma validate` also nags about the 8.0 RC on every run — that's expected and ignorable until we
deliberately plan an 8.x migration.

## 2026-09-16 — Prisma 7's default generator requires an explicit driver adapter

The new default `prisma-client` generator (replacing `prisma-client-js`) ships **no bundled query
engine binary** — `new PrismaClient()` with no arguments throws
`PrismaClientInitializationError: ... A driver adapter is required`. Fixed by installing
`@prisma/adapter-pg` + `pg` (+ `@types/pg`) and constructing the client as
`new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })` in
both `src/lib/prisma.ts` (the app singleton) and `prisma/seed.ts`. This is a real breaking change
from Prisma 5/6 era docs/training data, not a mistake — confirmed against current Prisma docs and
by reproducing the exact error.

## 2026-09-16 — Datasource URL and seed command live in `prisma7.config.ts`, not `schema.prisma`

Prisma 7 moves the connection URL and the `db seed` command out of `schema.prisma`'s `datasource`
block (no more `url = env("DATABASE_URL")` there) and out of `package.json`'s `prisma.seed` field,
into a dedicated `prisma.config.ts`-style file. In our installed 7.10.0, `prisma init` actually
generated it as **`prisma7.config.ts`** (not the plain `prisma.config.ts` shown in some docs
pages) — confirmed by the CLI's own generated comments referencing that exact filename twice
(in the file itself and in the `.env` header). Trusted the installed CLI's real behavior over the
fetched docs page here, since the docs may not have caught up to this exact patch version.

## 2026-09-16 — Primary keys use `uuid(7)`, not `cuid()`

Prisma's own docs describe `uuid(7)` as generating IDs "that sort by creation time" — better index
locality than random UUIDv4 while still being globally unique and creatable before insert (unlike
autoincrement, which doesn't fit a design with `String` FKs already chosen in the plan). Used
`String @id @default(uuid(7))` on every model.

## 2026-09-16 — `bcryptjs` installed one phase early (Phase 2, not Phase 3)

`User.passwordHash` is `NOT NULL` per the schema, so the Phase 2 seed script needs to write real
password hashes for the demo accounts to be immediately usable once Phase 3 (auth) lands — no need
to re-seed later. `bcryptjs` was already an approved Phase 3 dependency; this just moves its
installation earlier rather than seeding a placeholder string.

## 2026-09-16 — Generated Prisma Client is excluded from ESLint/Prettier

`src/generated/prisma/**` (gitignored, regenerated by `prisma generate`) was initially being
type-aware-linted by ESLint, taking ~40s for a single file. Added it to both `eslint.config.mjs`'s
`globalIgnores` and `.prettierignore` — it's not code we own or should reformat.

## 2026-09-15 — Don't pin Next.js/model versions in planning docs

## 2026-09-15 — Don't pin Next.js/model versions in planning docs

The initial architecture proposal named "Next.js 15" and "claude-sonnet-5" as concrete versions.
Before implementation started, both were deliberately left unpinned in favor of "verify the
current version/identifier at the time you actually use it" — training data goes stale, and
`create-next-app@latest` resolved to Next.js 16, which has real breaking changes (see below).

## 2026-09-15 — Next.js 16: `middleware.ts` → `proxy.ts`

Next.js 16 deprecates `middleware.ts`/`export function middleware()` in favor of `proxy.ts`/
`export function proxy()`. Functionality is the same, only the file/export name changed. Also
notable: the docs are explicit that Proxy is for optimistic checks (e.g. redirect-if-logged-out)
and is **not** a full session/authorization solution — real permission enforcement still belongs
in Server Components/Actions/Route Handlers, which matches the "never trust client-only checks"
requirement already baked into the permission model. Relevant when Phase 3 (auth) adds route
protection.

## 2026-09-15 — shadcn/ui components are copied in, not installed as a dependency

Chosen so components stay fully editable and there's no opaque runtime UI library to work around
when the design needs to diverge from the default. Initialized with the `radix` base and the
`nova` preset (Lucide icons, Geist font, CSS-variable theming via Tailwind v4's `@theme inline`).

## 2026-09-15 — Docker Compose for local Postgres, Neon for production

Local dev needs to work fully offline without an external account; production wants a live,
shareable Vercel deployment. Both were explicit user preferences during planning.
