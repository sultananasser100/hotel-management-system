import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/client";

// Adds our custom `role`/`id` fields to Auth.js's Session/User/JWT types.
// Pattern per Auth.js v5 docs: https://authjs.dev/getting-started/typescript
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

// Auth.js docs (https://authjs.dev/getting-started/typescript) document
// augmenting "next-auth/jwt", but next-auth's own NextAuthConfig callback
// signatures type `token` using `JWT` imported directly from
// "@auth/core/jwt" (verified in node_modules/@auth/core/index.d.ts) — so
// that's the module that actually needs augmenting for the `jwt`/`session`
// callbacks to type-check.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
