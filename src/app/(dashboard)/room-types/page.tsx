import { Tag } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function RoomTypesPage() {
  await requirePermission("roomTypes");
  return <PlaceholderPage title="Room Types" icon={Tag} />;
}
