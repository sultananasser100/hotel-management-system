import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ROLE_ONLY_ROUTE_PREFIXES } from "@/lib/permissions";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email : null;
        const password = typeof credentials?.password === "string" ? credentials.password : null;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;

        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // authorize() below always returns a concrete `id`, so this is safe
        // despite the base `User` type declaring `id` as optional.
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
    // Used by proxy.ts (the Next.js 16 successor to middleware.ts) for the
    // *optimistic* redirect layer only — see docs/DECISIONS.md. Authoritative
    // checks happen server-side via requireUser()/requireRole() in
    // src/lib/session.ts.
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const isLoginPage = pathname.startsWith("/login");

      if (isLoginPage) {
        // Already-authenticated users don't need the login page.
        return isLoggedIn ? Response.redirect(new URL("/dashboard", request.nextUrl)) : true;
      }

      if (!isLoggedIn) {
        // Returning false triggers Auth.js's built-in redirect to `pages.signIn`.
        return false;
      }

      const roleOnlyRoute = ROLE_ONLY_ROUTE_PREFIXES.find(({ prefix }) =>
        pathname.startsWith(prefix),
      );
      if (roleOnlyRoute && auth.user.role !== roleOnlyRoute.role) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      return true;
    },
  },
});
