import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DashboardData } from "@/lib/dashboard";
import { RelativeTime } from "@/components/dashboard/relative-time";

const ACTION_LABEL: Record<string, string> = {
  CHECK_IN: "checked in",
  CHECK_OUT: "checked out",
  CREATE_RESERVATION: "created a reservation for",
  CANCEL_RESERVATION: "cancelled a reservation for",
  COMPLETE_TASK: "completed a task on",
};

function describeAction(action: string, entityType: string): string {
  const verb = ACTION_LABEL[action] ?? action.replace(/_/g, " ").toLowerCase();
  const entity = entityType.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return `${verb} ${entity}`;
}

type RecentActivityProps = {
  entries: DashboardData["recentActivity"];
};

export function RecentActivity({ entries }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Latest actions across the hotel</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <Activity className="size-5" />
            <span>No recent activity.</span>
          </div>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-4 text-sm">
                <span>
                  <span className="font-medium">{entry.userName ?? "System"}</span>{" "}
                  <span className="text-muted-foreground">
                    {describeAction(entry.action, entry.entityType)}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <RelativeTime date={entry.createdAt} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
