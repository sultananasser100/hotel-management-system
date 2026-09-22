import { HousekeepingTaskPriority, HousekeepingTaskType } from "@/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HOUSEKEEPING_TASK_TYPE_LABEL, PRIORITY_LABEL } from "@/lib/housekeeping-rules";

type ByTypeProps = {
  byType: { type: HousekeepingTaskType; count: number }[];
};

export function HousekeepingByType({ byType }: ByTypeProps) {
  const max = Math.max(1, ...byType.map((t) => t.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks by type</CardTitle>
      </CardHeader>
      <CardContent>
        {byType.every((t) => t.count === 0) ? (
          <p className="text-sm text-muted-foreground">No tasks created in this range.</p>
        ) : (
          <ul className="space-y-3">
            {byType.map(({ type, count }) => (
              <li key={type} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm">{HOUSEKEEPING_TASK_TYPE_LABEL[type]}</span>
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

type ByPriorityProps = {
  byPriority: { priority: HousekeepingTaskPriority; count: number }[];
};

export function HousekeepingByPriority({ byPriority }: ByPriorityProps) {
  const max = Math.max(1, ...byPriority.map((p) => p.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks by priority</CardTitle>
      </CardHeader>
      <CardContent>
        {byPriority.every((p) => p.count === 0) ? (
          <p className="text-sm text-muted-foreground">No tasks created in this range.</p>
        ) : (
          <ul className="space-y-3">
            {byPriority.map(({ priority, count }) => (
              <li key={priority} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm">{PRIORITY_LABEL[priority]}</span>
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
