# Decisions log

Short entries for decisions worth remembering the "why" of. Newest first.

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
