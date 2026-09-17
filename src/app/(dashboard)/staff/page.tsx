import { UserCog } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function StaffPage() {
  await requirePermission("staff");
  return <PlaceholderPage title="Staff" icon={UserCog} />;
}
