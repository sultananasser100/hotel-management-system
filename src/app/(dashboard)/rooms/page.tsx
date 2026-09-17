import { BedDouble } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function RoomsPage() {
  await requirePermission("rooms");
  return <PlaceholderPage title="Rooms" icon={BedDouble} />;
}
