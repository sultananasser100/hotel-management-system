import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import type { Session } from "next-auth";
import type { NotificationListItem } from "@/lib/notifications";

type SiteHeaderProps = {
  user: Session["user"];
  notifications: NotificationListItem[];
  unreadNotificationCount: number;
};

export function SiteHeader({ user, notifications, unreadNotificationCount }: SiteHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex-1" />
      <NotificationBell notifications={notifications} unreadCount={unreadNotificationCount} />
      <UserMenu user={user} />
    </header>
  );
}
