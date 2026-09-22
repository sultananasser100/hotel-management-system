"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationRow } from "@/components/layout/notification-row";
import { MarkAllReadButton } from "@/components/layout/mark-all-read-button";
import type { NotificationListItem } from "@/lib/notifications";

type NotificationBellProps = {
  notifications: NotificationListItem[];
  unreadCount: number;
};

export function NotificationBell({ notifications, unreadCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-full p-1.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
          <span className="sr-only">
            Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ""}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && <MarkAllReadButton onDone={() => setOpen(false)} />}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-sm text-muted-foreground">
            <Bell className="size-5" />
            <span>No notifications.</span>
          </div>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto px-1 py-1">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationRow notification={notification} onNavigate={() => setOpen(false)} />
              </li>
            ))}
          </ul>
        )}
        <DropdownMenuSeparator />
        <Button asChild variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}>
          <Link href="/notifications">View all</Link>
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
