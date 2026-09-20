import type { Prisma } from "@/generated/prisma/client";
import { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { formatTimestamp } from "@/lib/format";
import { PAYMENTS_PAGE_SIZE } from "@/lib/payment-constants";
import { summarizePayments, toCents } from "@/lib/payment-balance";

type Db = Prisma.TransactionClient;

// Authoritative balance for one reservation, read fresh (use inside a transaction under the lock).
export async function getPaymentSummary(db: Db, reservationId: string) {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      status: true,
      totalAmount: true,
      payments: { select: { amount: true, status: true } },
    },
  });
  if (!reservation) return null;

  return summarizePayments({
    status: reservation.status,
    totalAmount: Number(reservation.totalAmount),
    payments: reservation.payments.map((p) => ({ amount: Number(p.amount), status: p.status })),
  });
}

// COMPLETED payments per reservation, in cents, for a page of reservations in one query.
export async function getPaidCentsByReservation(
  reservationIds: string[],
): Promise<Map<string, number>> {
  if (reservationIds.length === 0) return new Map();

  const rows = await prisma.payment.groupBy({
    by: ["reservationId"],
    where: { reservationId: { in: reservationIds }, status: PaymentStatus.COMPLETED },
    _sum: { amount: true },
  });
  return new Map(rows.map((row) => [row.reservationId, toCents(Number(row._sum.amount ?? 0))]));
}

export type PaymentFilters = {
  query: string;
  status: PaymentStatus | "";
  method: PaymentMethod | "";
  from: Date | null;
  to: Date | null;
  page: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function buildWhere({ query, status, method, from, to }: PaymentFilters): Prisma.PaymentWhereInput {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);

  // Filter on the payment date (paidAt), falling back to when the row was created for unpaid ones.
  const range: Prisma.DateTimeFilter = {};
  if (from) range.gte = from;
  if (to) range.lt = new Date(to.getTime() + DAY_MS);

  return {
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
    AND: [
      ...(from || to ? [{ OR: [{ paidAt: range }, { paidAt: null, createdAt: range }] }] : []),
      ...words.map((word) => ({
        OR: [
          {
            reservation: {
              confirmationCode: { contains: word, mode: "insensitive" as const },
            },
          },
          {
            reservation: {
              guest: { firstName: { contains: word, mode: "insensitive" as const } },
            },
          },
          {
            reservation: {
              guest: { lastName: { contains: word, mode: "insensitive" as const } },
            },
          },
        ],
      })),
    ],
  };
}

export async function getPayments(filters: PaymentFilters) {
  const where = buildWhere(filters);
  const total = await prisma.payment.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAYMENTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), totalPages);

  const rows = await prisma.payment.findMany({
    where,
    include: {
      reservation: {
        select: {
          id: true,
          confirmationCode: true,
          guest: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAYMENTS_PAGE_SIZE,
    take: PAYMENTS_PAGE_SIZE,
  });

  const items = rows.map((p) => ({
    id: p.id,
    reservationId: p.reservation.id,
    confirmationCode: p.reservation.confirmationCode,
    guestId: p.reservation.guest.id,
    guestName: `${p.reservation.guest.firstName} ${p.reservation.guest.lastName}`,
    method: p.method,
    status: p.status,
    amount: Number(p.amount),
    reference: p.transactionRef,
    dateLabel: formatTimestamp(p.paidAt ?? p.createdAt),
    recordedBy: p.createdBy.name,
  }));

  return { items, total, page, totalPages };
}

export type PaymentLedgerItem = Awaited<ReturnType<typeof getPayments>>["items"][number];
