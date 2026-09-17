import { Settings as SettingsIcon } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function SettingsPage() {
  await requirePermission("settings");
  return <PlaceholderPage title="Settings" icon={SettingsIcon} />;
}
