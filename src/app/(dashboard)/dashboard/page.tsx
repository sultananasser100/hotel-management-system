import { requireUser } from "@/lib/session";

// Minimal on purpose — the real dashboard (cards, charts, activity) is built
// in Phase 5. This just confirms the shell + session wiring works.
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user.name}</h1>
      <p className="text-muted-foreground">Here&apos;s what&apos;s happening at the hotel today.</p>
    </div>
  );
}
