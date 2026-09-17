import { CreditCard } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function PaymentsPage() {
  await requirePermission("payments");
  return <PlaceholderPage title="Payments" icon={CreditCard} />;
}
