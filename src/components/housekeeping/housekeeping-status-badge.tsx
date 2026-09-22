import type { VariantProps } from "class-variance-authority";
import { HousekeepingStatus } from "@/generated/prisma/enums";
import { HOUSEKEEPING_STATE_LABEL } from "@/lib/housekeeping-rules";
import { Badge, type badgeVariants } from "@/components/ui/badge";

const STATUS_VARIANT: Record<
  HousekeepingStatus,
  NonNullable<VariantProps<typeof badgeVariants>["variant"]>
> = {
  DIRTY: "destructive",
  IN_PROGRESS: "secondary",
  CLEAN: "default",
  INSPECTED: "outline",
};

export function HousekeepingStatusBadge({ status }: { status: HousekeepingStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{HOUSEKEEPING_STATE_LABEL[status]}</Badge>;
}
