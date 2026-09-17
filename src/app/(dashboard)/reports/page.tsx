import { BarChart3 } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function ReportsPage() {
  await requirePermission("reports");
  return <PlaceholderPage title="Reports" icon={BarChart3} />;
}
