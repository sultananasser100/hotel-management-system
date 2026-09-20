import { PaymentStatus, ReservationStatus } from "@/generated/prisma/enums";

// The one place balances are calculated. Everything is done in whole cents so
// there is no floating-point drift; amounts are exact to the cent, so nothing rounds.

export type PaymentState = "none" | "unpaid" | "partial" | "paid" | "overpaid" | "refundable";

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  none: "Nothing owed",
  unpaid: "Unpaid",
  partial: "Partially paid",
  paid: "Paid in full",
  overpaid: "Overpaid",
  refundable: "Refundable",
};

export type PaymentSummary = {
  total: number;
  // What the guest owes: the total, or 0 for cancelled / no-show reservations (no fees exist).
  owed: number;
  // Sum of COMPLETED payments only.
  paid: number;
  // Still to collect (never negative).
  balance: number;
  // Paid beyond what is owed: overpaid, or refundable after a cancellation / no-show.
  credit: number;
  balanceCents: number;
  creditCents: number;
  paidCents: number;
  state: PaymentState;
};

const NO_CHARGE_STATUSES: ReservationStatus[] = [
  ReservationStatus.CANCELLED,
  ReservationStatus.NO_SHOW,
];

export function toCents(value: number | string): number {
  return Math.round(Number(value) * 100);
}

export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function summarizeCents(input: {
  status: ReservationStatus;
  totalAmount: number | string;
  paidCents: number;
}): PaymentSummary {
  const totalCents = toCents(input.totalAmount);
  const noCharge = NO_CHARGE_STATUSES.includes(input.status);
  const owedCents = noCharge ? 0 : totalCents;
  const diff = owedCents - input.paidCents;
  const balanceCents = Math.max(0, diff);
  const creditCents = Math.max(0, -diff);

  let state: PaymentState;
  if (creditCents > 0) state = noCharge ? "refundable" : "overpaid";
  else if (owedCents === 0) state = "none";
  else if (balanceCents === 0) state = "paid";
  else if (input.paidCents === 0) state = "unpaid";
  else state = "partial";

  return {
    total: totalCents / 100,
    owed: owedCents / 100,
    paid: input.paidCents / 100,
    balance: balanceCents / 100,
    credit: creditCents / 100,
    balanceCents,
    creditCents,
    paidCents: input.paidCents,
    state,
  };
}

export function summarizePayments(input: {
  status: ReservationStatus;
  totalAmount: number | string;
  payments: { amount: number | string; status: PaymentStatus }[];
}): PaymentSummary {
  const paidCents = input.payments
    .filter((payment) => payment.status === PaymentStatus.COMPLETED)
    .reduce((sum, payment) => sum + toCents(payment.amount), 0);
  return summarizeCents({ status: input.status, totalAmount: input.totalAmount, paidCents });
}

const AMOUNT_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

// Rejects (rather than rounds) anything that isn't a positive amount with at most 2 decimals.
export function parsePaymentAmount(raw: string): { cents: number } | { error: string } {
  const value = raw.trim();
  if (!AMOUNT_PATTERN.test(value)) {
    return { error: "Enter a valid amount with at most 2 decimal places." };
  }
  const cents = toCents(value);
  if (cents <= 0) return { error: "The amount must be greater than zero." };
  return { cents };
}

// Guards against a card number being pasted into the free-text reference.
export function looksLikeCardNumber(value: string): boolean {
  return /\d{13,}/.test(value.replace(/[\s-]/g, ""));
}
