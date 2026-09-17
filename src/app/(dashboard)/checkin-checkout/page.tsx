import { DoorOpen } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function CheckInCheckOutPage() {
  await requirePermission("checkInOut");
  return <PlaceholderPage title="Check-in / Check-out" icon={DoorOpen} />;
}
