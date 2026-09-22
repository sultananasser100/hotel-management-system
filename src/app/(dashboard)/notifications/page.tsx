import Link from "next/link";
import { Bell } from "lucide-react";
import { requirePermission } from "@/lib/session";
import {
  getNotificationsPage,
  NOTIFICATIONS_PAGE_SIZE,
  type NotificationFilter,
} from "@/lib/notifications";
import { NotificationRow } from "@/components/layout/notification-row";
import { MarkAllReadButton } from "@/components/layout/mark-all-read-button";
import { PaginationBar } from "@/components/pagination-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requirePermission("notifications");
  const params = await searchParams;

  const filter: NotificationFilter = firstValue(params.filter) === "unread" ? "unread" : "all";
  const parsedPage = Number.parseInt(firstValue(params.page), 10);
  const requestedPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { items, total, page, totalPages } = await getNotificationsPage(
    { id: user.id, role: user.role },
    { page: requestedPage, filter },
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Updates relevant to your role.</p>
        </div>
        <MarkAllReadButton />
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant={filter === "all" ? "secondary" : "outline"} size="sm">
          <Link href="/notifications">All</Link>
        </Button>
        <Button asChild variant={filter === "unread" ? "secondary" : "outline"} size="sm">
          <Link href="/notifications?filter=unread">Unread</Link>
        </Button>
      </div>

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Bell className="size-5" />
              <span>{filter === "unread" ? "No unread notifications." : "No notifications."}</span>
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-1">
                {items.map((notification) => (
                  <li key={notification.id}>
                    <NotificationRow notification={notification} />
                  </li>
                ))}
              </ul>
              <PaginationBar
                basePath="/notifications"
                params={{ filter: filter === "unread" ? "unread" : "" }}
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={NOTIFICATIONS_PAGE_SIZE}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
