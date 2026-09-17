import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";

/**
 * Authoritative session/role checks for Server Components, Server Actions, and
 * Route Handlers. proxy.ts only does optimistic, cookie-based redirects for UX —
 * every real permission check must go through these instead (or through the
 * `session()` returned by `auth()` directly, then `can()` from permissions.ts).
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect("/dashboard");
  }
  return user;
}
