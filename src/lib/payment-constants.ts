import { PaymentMethod, PaymentStatus, ReservationStatus } from "@/generated/prisma/enums";

export const PAYMENTS_PAGE_SIZE = 15;
export const MAX_REFERENCE_LENGTH = 100;

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  ONLINE: "Online",
};

// FAILED is how a voided payment is stored; there is no payment gateway, so it has no other use yet.
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  FAILED: "Voided",
  REFUNDED: "Refunded",
};

// Payments can be recorded until the stay is over or the reservation is cancelled/no-show.
export const PAYABLE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKED_OUT,
];
