import type { VariantProps } from "class-variance-authority";
import { PaymentStatus } from "@/generated/prisma/enums";
import { PAYMENT_STATUS_LABEL } from "@/lib/payment-constants";
import { Badge, type badgeVariants } from "@/components/ui/badge";

const STATUS_VARIANT: Record<
  PaymentStatus,
  NonNullable<VariantProps<typeof badgeVariants>["variant"]>
> = {
  PENDING: "secondary",
  COMPLETED: "default",
  FAILED: "destructive",
  REFUNDED: "outline",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{PAYMENT_STATUS_LABEL[status]}</Badge>;
}
