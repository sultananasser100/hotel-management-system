import { ReservationStatus } from "@/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReservationStatusBadge } from "@/components/dashboard/reservation-status-badge";

type ReservationsByStatusProps = {
  breakdown: { status: ReservationStatus; count: number }[];
  // Defaults to the dashboard's all-time framing; callers filtering to a
  // date range (e.g. Reports) should pass a description that says so.
  description?: string;
};

export function ReservationsByStatus({ breakdown, description }: ReservationsByStatusProps) {
  const total = breakdown.reduce((sum, b) => sum + b.count, 0);
  const max = Math.max(1, ...breakdown.map((b) => b.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reservations by status</CardTitle>
        <CardDescription>{description ?? `${total} reservations on record`}</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No reservations found.</p>
        ) : (
          <ul className="space-y-3">
            {breakdown.map(({ status, count }) => (
              <li key={status} className="flex items-center gap-3">
                <div className="w-32 shrink-0">
                  <ReservationStatusBadge status={status} />
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-medium">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
