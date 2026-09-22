import type { HousekeepingStatus } from "@/generated/prisma/enums";
import { HOUSEKEEPING_STATE_LABEL } from "@/lib/housekeeping-rules";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function HousekeepingSummary({
  counts,
}: {
  counts: { status: HousekeepingStatus; count: number }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {counts.map(({ status, count }) => (
        <Card key={status}>
          <CardHeader>
            <span className="text-sm text-muted-foreground">
              {HOUSEKEEPING_STATE_LABEL[status]}
            </span>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold tracking-tight">{count}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
