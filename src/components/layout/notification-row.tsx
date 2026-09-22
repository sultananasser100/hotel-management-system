"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CreditCard, Sparkles, Bell, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { NotificationType } from "@/generated/prisma/enums";
import { RelativeTime } from "@/components/dashboard/relative-time";
import { markNotificationReadAction } from "@/lib/actions/notifications";
import type { NotificationListItem } from "@/lib/notifications";

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  [NotificationType.RESERVATION]: CalendarCheck,
  [NotificationType.PAYMENT]: CreditCard,
  [NotificationType.HOUSEKEEPING]: Sparkles,
  [NotificationType.SYSTEM]: Bell,
};

// Kept local (not shared from src/lib/notifications.ts) so this client
// component never imports a module that pulls in the Prisma runtime —
// see the Phase 4 Client/Server Component boundary note in the dev log.
function notificationHref(notification: NotificationListItem): string | null {
  if (notification.relatedEntityType === "Reservation" && notification.relatedEntityId) {
    return `/reservations/${notification.relatedEntityId}`;
  }
  if (notification.type === NotificationType.HOUSEKEEPING) return "/housekeeping";
  return null;
}

type NotificationRowProps = {
  notification: NotificationListItem;
  onNavigate?: () => void;
};

export function NotificationRow({ notification, onNavigate }: NotificationRowProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const Icon = TYPE_ICON[notification.type];
  const href = notificationHref(notification);

  function handleClick() {
    if (!notification.isRead) {
      startTransition(async () => {
        await markNotificationReadAction(notification.id);
      });
    }
    onNavigate?.();
    if (href) router.push(href);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-md p-2 text-left text-sm transition-colors hover:bg-muted",
        !notification.isRead && "bg-muted/40",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn(!notification.isRead && "font-semibold")}>{notification.title}</span>
          {!notification.isRead && (
            <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          )}
        </span>
        <span className="block text-muted-foreground">{notification.message}</span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        <RelativeTime date={notification.createdAt} />
      </span>
    </button>
  );
}
