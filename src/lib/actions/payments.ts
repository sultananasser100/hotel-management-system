"use server";

import { revalidatePath } from "next/cache";
import { NotificationType, PaymentMethod, PaymentStatus, Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { formatCurrency } from "@/lib/format";
import { getPaymentSummary } from "@/lib/payments";
import { notifyRole } from "@/lib/notifications";
import {
  centsToDecimalString,
  looksLikeCardNumber,
  parsePaymentAmount,
  toCents,
} from "@/lib/payment-balance";
import { MAX_REFERENCE_LENGTH, PAYABLE_RESERVATION_STATUSES } from "@/lib/payment-constants";
import { lockReservation } from "@/lib/reservation-lock";

export type RecordPaymentState =
  { status: "idle" } | { status: "error"; error: string } | { status: "success"; message: string };

export type PaymentActionResult =
  { status: "error"; error: string } | { status: "success"; message: string };

class PaymentError extends Error {}

const METHOD_VALUES = new Set<string>(Object.values(PaymentMethod));

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function revalidatePayments(reservationId: string) {
  revalidatePath(`/reservations/${reservationId}`);
  revalidatePath("/reservations");
  revalidatePath("/payments");
  revalidatePath("/checkin-checkout");
}

export async function recordPaymentAction(
  _prevState: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  const user = await requirePermission("payments", "manage");

  const reservationId = field(formData, "reservationId");
  if (!reservationId) return { status: "error", error: "Missing reservation id." };

  const amount = parsePaymentAmount(field(formData, "amount"));
  if ("error" in amount) return { status: "error", error: amount.error };

  const method = field(formData, "method");
  if (!METHOD_VALUES.has(method)) return { status: "error", error: "Select a payment method." };

  const reference = field(formData, "reference");
  if (reference.length > MAX_REFERENCE_LENGTH) {
    return {
      status: "error",
      error: `The reference must be ${MAX_REFERENCE_LENGTH} characters or fewer.`,
    };
  }
  if (looksLikeCardNumber(reference)) {
    return {
      status: "error",
      error:
        "The reference looks like a card number. Enter a receipt or transaction number instead.",
    };
  }

  try {
    const message = await prisma.$transaction(async (tx) => {
      await lockReservation(tx, reservationId);

      // Everything below is read under the lock, so it can't change before the write.
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: { status: true, confirmationCode: true },
      });
      if (!reservation) throw new PaymentError("Reservation not found.");
      if (!PAYABLE_RESERVATION_STATUSES.includes(reservation.status)) {
        throw new PaymentError("Payments can't be recorded for cancelled or no-show reservations.");
      }

      const summary = await getPaymentSummary(tx, reservationId);
      if (!summary || summary.balanceCents <= 0) {
        throw new PaymentError("This reservation has no balance due.");
      }
      if (amount.cents > summary.balanceCents) {
        throw new PaymentError(
          `The amount exceeds the remaining balance of ${formatCurrency(summary.balance)}.`,
        );
      }

      const payment = await tx.payment.create({
        data: {
          reservationId,
          amount: centsToDecimalString(amount.cents),
          method: method as PaymentMethod,
          status: PaymentStatus.COMPLETED,
          transactionRef: reference || null,
          paidAt: new Date(),
          createdById: user.id,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "RECORD_PAYMENT",
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            confirmationCode: reservation.confirmationCode,
            reservationId,
            amount: amount.cents / 100,
            method,
          },
        },
      });

      await notifyRole(tx, Role.ADMIN, {
        type: NotificationType.PAYMENT,
        title: "Payment recorded",
        message: `${formatCurrency(amount.cents / 100)} recorded for ${reservation.confirmationCode}.`,
        relatedEntityType: "Reservation",
        relatedEntityId: reservationId,
      });

      return `Recorded ${formatCurrency(amount.cents / 100)} for ${reservation.confirmationCode}.`;
    });

    revalidatePayments(reservationId);
    return { status: "success", message };
  } catch (error) {
    if (error instanceof PaymentError) return { status: "error", error: error.message };
    throw error;
  }
}

type Transition = {
  action: string;
  allowedFrom: PaymentStatus[];
  to: PaymentStatus;
  adminOnly: boolean;
  success: string;
  // Marking received adds money to the reservation, so it needs a payable reservation and room in the balance.
  addsMoney: boolean;
};

async function transitionPayment(
  paymentId: string,
  transition: Transition,
): Promise<PaymentActionResult> {
  const user = await requirePermission("payments", "manage");
  if (transition.adminOnly && user.role !== Role.ADMIN) {
    return { status: "error", error: "Only an administrator can do this." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const preview = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { reservationId: true },
      });
      if (!preview) throw new PaymentError("Payment not found.");

      await lockReservation(tx, preview.reservationId);

      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { reservation: { select: { status: true, confirmationCode: true } } },
      });
      if (!payment) throw new PaymentError("Payment not found.");
      if (!transition.allowedFrom.includes(payment.status)) {
        throw new PaymentError("This payment has already changed. Refresh the page and try again.");
      }

      if (transition.addsMoney) {
        if (!PAYABLE_RESERVATION_STATUSES.includes(payment.reservation.status)) {
          throw new PaymentError(
            "Payments can't be recorded for cancelled or no-show reservations.",
          );
        }
        const summary = await getPaymentSummary(tx, payment.reservationId);
        if (!summary || toCents(Number(payment.amount)) > summary.balanceCents) {
          throw new PaymentError(
            "This payment exceeds the reservation's remaining balance, so it can't be marked received.",
          );
        }
      }

      // Guarded write: a concurrent change makes count 0.
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, status: payment.status },
        data: {
          status: transition.to,
          ...(transition.to === PaymentStatus.COMPLETED ? { paidAt: new Date() } : {}),
        },
      });
      if (updated.count === 0) {
        throw new PaymentError("This payment has already changed. Refresh the page and try again.");
      }

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: transition.action,
          entityType: "Payment",
          entityId: paymentId,
          metadata: {
            confirmationCode: payment.reservation.confirmationCode,
            reservationId: payment.reservationId,
            amount: Number(payment.amount),
            method: payment.method,
            previousStatus: payment.status,
          },
        },
      });

      if (transition.to === PaymentStatus.COMPLETED) {
        await notifyRole(tx, Role.ADMIN, {
          type: NotificationType.PAYMENT,
          title: "Payment recorded",
          message: `${formatCurrency(Number(payment.amount))} recorded for ${payment.reservation.confirmationCode}.`,
          relatedEntityType: "Reservation",
          relatedEntityId: payment.reservationId,
        });
      }

      return {
        reservationId: payment.reservationId,
        message: `${transition.success} ${formatCurrency(Number(payment.amount))} (${payment.reservation.confirmationCode}).`,
      };
    });

    revalidatePayments(result.reservationId);
    return { status: "success", message: result.message };
  } catch (error) {
    if (error instanceof PaymentError) return { status: "error", error: error.message };
    throw error;
  }
}

export async function markPaymentReceivedAction(paymentId: string): Promise<PaymentActionResult> {
  return transitionPayment(paymentId, {
    action: "RECEIVE_PAYMENT",
    allowedFrom: [PaymentStatus.PENDING],
    to: PaymentStatus.COMPLETED,
    adminOnly: false,
    success: "Marked received:",
    addsMoney: true,
  });
}

// Voided payments are stored as FAILED and excluded from the balance; rows are never deleted or edited.
export async function voidPaymentAction(paymentId: string): Promise<PaymentActionResult> {
  return transitionPayment(paymentId, {
    action: "VOID_PAYMENT",
    allowedFrom: [PaymentStatus.PENDING, PaymentStatus.COMPLETED],
    to: PaymentStatus.FAILED,
    adminOnly: true,
    success: "Voided:",
    addsMoney: false,
  });
}

export async function refundPaymentAction(paymentId: string): Promise<PaymentActionResult> {
  return transitionPayment(paymentId, {
    action: "REFUND_PAYMENT",
    allowedFrom: [PaymentStatus.COMPLETED],
    to: PaymentStatus.REFUNDED,
    adminOnly: true,
    success: "Refunded:",
    addsMoney: false,
  });
}
