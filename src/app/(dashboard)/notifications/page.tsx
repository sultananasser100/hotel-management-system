import { Bell } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function NotificationsPage() {
  await requirePermission("notifications");
  return <PlaceholderPage title="Notifications" icon={Bell} />;
}
