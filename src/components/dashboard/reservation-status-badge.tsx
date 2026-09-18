import { ReservationStatus } from "@/generated/prisma/enums";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

const STATUS_VARIANT: Record<
  ReservationStatus,
  NonNullable<VariantProps<typeof badgeVariants>["variant"]>
> = {
  PENDING: "secondary",
  CONFIRMED: "default",
  CHECKED_IN: "default",
  CHECKED_OUT: "outline",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function reservationStatusLabel(status: ReservationStatus): string {
  return STATUS_LABEL[status];
}
