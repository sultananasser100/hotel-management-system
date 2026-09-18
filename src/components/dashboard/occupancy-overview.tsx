import { RoomStatus } from "@/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const STATUS_LABEL: Record<RoomStatus, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  MAINTENANCE: "Maintenance",
  OUT_OF_SERVICE: "Out of service",
};

// Fixed hue order, one chart token per room status — matches ROOM_STATUS_ORDER
// in src/lib/dashboard.ts so a status always maps to the same color.
const STATUS_COLOR: Record<RoomStatus, string> = {
  AVAILABLE: "bg-chart-1",
  OCCUPIED: "bg-chart-2",
  RESERVED: "bg-chart-3",
  MAINTENANCE: "bg-chart-4",
  OUT_OF_SERVICE: "bg-chart-5",
};

type OccupancyOverviewProps = {
  breakdown: { status: RoomStatus; count: number }[];
};

export function OccupancyOverview({ breakdown }: OccupancyOverviewProps) {
  const total = breakdown.reduce((sum, b) => sum + b.count, 0);
  const segments = breakdown.filter((b) => b.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Occupancy overview</CardTitle>
        <CardDescription>Room status across all {total} rooms</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No rooms found.</p>
        ) : (
          <>
            <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded-md">
              {segments.map(({ status, count }) => (
                <div
                  key={status}
                  className={STATUS_COLOR[status]}
                  style={{ width: `${(count / total) * 100}%` }}
                  title={`${STATUS_LABEL[status]}: ${count}`}
                />
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {breakdown.map(({ status, count }) => (
                <li key={status} className="flex items-center gap-2 text-sm">
                  <span className={`size-2.5 shrink-0 rounded-full ${STATUS_COLOR[status]}`} />
                  <span className="text-muted-foreground">{STATUS_LABEL[status]}</span>
                  <span className="ml-auto font-medium">{count}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
