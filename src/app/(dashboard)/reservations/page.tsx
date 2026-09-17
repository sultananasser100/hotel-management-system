import { CalendarCheck } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function ReservationsPage() {
  await requirePermission("reservations");
  return <PlaceholderPage title="Reservations" icon={CalendarCheck} />;
}
