import { Users } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function GuestsPage() {
  await requirePermission("guests");
  return <PlaceholderPage title="Guests" icon={Users} />;
}
