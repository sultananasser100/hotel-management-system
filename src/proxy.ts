// Next.js 16 renamed middleware.ts -> proxy.ts (same behavior, new file/export
// name — see docs/DECISIONS.md). `auth` here is the Auth.js-wrapped request
// handler; the actual authorization logic lives in the `authorized` callback
// in src/lib/auth.ts. This file only wires it up as the proxy.
export { auth as proxy } from "@/lib/auth";

export const config = {
  // Run on every route except static assets, images, and the NextAuth API
  // routes themselves (those must stay reachable to issue/clear sessions).
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)",
  ],
};
