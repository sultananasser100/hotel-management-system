import { requireUser } from "@/lib/session";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

// Intentionally minimal — this placeholder just proves the auth flow works
// end-to-end (login -> session -> role -> logout). The real dashboard layout
// (sidebar, header, cards) is built in Phase 4.
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-lg">
        Signed in as <span className="font-medium">{user.name}</span> (
        <span className="font-medium">{user.role}</span>)
      </p>
      <form action={logoutAction}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
