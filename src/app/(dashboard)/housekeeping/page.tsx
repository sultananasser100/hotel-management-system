import { Sparkles } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function HousekeepingPage() {
  await requirePermission("housekeeping");
  return <PlaceholderPage title="Housekeeping" icon={Sparkles} />;
}
