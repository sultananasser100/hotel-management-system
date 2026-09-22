import {
  HousekeepingTaskPriority,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
  PaymentMethod,
  PaymentStatus,
  RoomStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { RESERVATION_STATUS_ORDER } from "@/lib/dashboard";
import { summarizeCents, toCents } from "@/lib/payment-balance";
import { getPaidCentsByReservation } from "@/lib/payments";
import { PAYABLE_RESERVATION_STATUSES } from "@/lib/payment-constants";
import { OPEN_TASK_STATUSES } from "@/lib/housekeeping-rules";
import { REPORTABLE_OCCUPANCY_STATUSES } from "@/lib/report-constants";
import { addDays, buildDateBuckets, daysBetween, overlappingNights, type DateRange } from "@/lib/report-utils";

// Tasks whose current status means the work is done. The complement of
// OPEN_TASK_STATUSES within HousekeepingTaskStatus's 4 values, so every task
// created in range lands in exactly one of the two buckets.
const COMPLETED_TASK_STATUSES: HousekeepingTaskStatus[] = [
  HousekeepingTaskStatus.COMPLETED,
  HousekeepingTaskStatus.VERIFIED,
];

export async function getRevenueReport({ from, to }: DateRange) {
  const rangeEndExclusive = addDays(to, 1);
  // Same "paidAt, falling back to createdAt" convention as payments.ts's own filter.
  const dateWhere = {
    OR: [
      { paidAt: { gte: from, lt: rangeEndExclusive } },
      { paidAt: null, createdAt: { gte: from, lt: rangeEndExclusive } },
    ],
  };

  const [receivedAgg, refundedAgg, byMethodRows, paymentsForTrend, payableReservations] =
    await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.COMPLETED, ...dateWhere },
      }),
      // "Voided" payments are stored as FAILED (see payment-constants.ts) — both count as money
      // that isn't received.
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: { in: [PaymentStatus.REFUNDED, PaymentStatus.FAILED] }, ...dateWhere },
      }),
      prisma.payment.groupBy({
        by: ["method"],
        where: { status: PaymentStatus.COMPLETED, ...dateWhere },
        _sum: { amount: true },
      }),
      prisma.payment.findMany({
        where: { status: PaymentStatus.COMPLETED, ...dateWhere },
        select: { amount: true, paidAt: true, createdAt: true },
      }),
      // Outstanding balance is deliberately NOT date-range filtered — it's a
      // present-tense, all-time figure ("what's still owed right now").
      prisma.reservation.findMany({
        where: { status: { in: PAYABLE_RESERVATION_STATUSES } },
        select: { id: true, status: true, totalAmount: true },
      }),
    ]);

  const receivedCents = toCents(Number(receivedAgg._sum.amount ?? 0));
  const refundedCents = toCents(Number(refundedAgg._sum.amount ?? 0));

  const byMethod = (Object.values(PaymentMethod) as PaymentMethod[]).map((method) => ({
    method,
    cents: toCents(Number(byMethodRows.find((row) => row.method === method)?._sum.amount ?? 0)),
  }));

  const buckets = buildDateBuckets(from, to);
  const trend = buckets.map((bucket) => {
    const bucketEndExclusive = addDays(bucket.end, 1);
    const cents = paymentsForTrend.reduce((sum, payment) => {
      const date = payment.paidAt ?? payment.createdAt;
      return date >= bucket.start && date < bucketEndExclusive ? sum + toCents(Number(payment.amount)) : sum;
    }, 0);
    return { label: bucket.label, cents };
  });

  const paidCentsByReservation = await getPaidCentsByReservation(payableReservations.map((r) => r.id));
  const outstandingCents = payableReservations.reduce((sum, r) => {
    const summary = summarizeCents({
      status: r.status,
      totalAmount: Number(r.totalAmount),
      paidCents: paidCentsByReservation.get(r.id) ?? 0,
    });
    return sum + summary.balanceCents;
  }, 0);

  return { receivedCents, refundedCents, outstandingCents, byMethod, trend };
}

export async function getOccupancyReport({ from, to }: DateRange) {
  const rangeEndExclusive = addDays(to, 1);

  const [activeRoomCount, roomStatusCounts, reservations] = await Promise.all([
    prisma.room.count({ where: { isActive: true } }),
    prisma.room.groupBy({ by: ["status"], where: { isActive: true }, _count: { _all: true } }),
    prisma.reservation.findMany({
      where: {
        status: { in: REPORTABLE_OCCUPANCY_STATUSES },
        checkInDate: { lt: rangeEndExclusive },
        checkOutDate: { gt: from },
      },
      select: { checkInDate: true, checkOutDate: true },
    }),
  ]);

  const roomCountByStatus = new Map(roomStatusCounts.map((r) => [r.status, r._count._all]));
  const rangeDays = daysBetween(from, to);

  const totalRoomNights = reservations.reduce(
    (sum, r) => sum + overlappingNights(r.checkInDate, r.checkOutDate, from, rangeEndExclusive),
    0,
  );
  const occupancyRate = activeRoomCount > 0 ? totalRoomNights / (activeRoomCount * rangeDays) : 0;

  const buckets = buildDateBuckets(from, to);
  const trend = buckets.map((bucket) => {
    const bucketEndExclusive = addDays(bucket.end, 1);
    const bucketDays = daysBetween(bucket.start, bucket.end);
    const nights = reservations.reduce(
      (sum, r) => sum + overlappingNights(r.checkInDate, r.checkOutDate, bucket.start, bucketEndExclusive),
      0,
    );
    const rate = activeRoomCount > 0 ? nights / (activeRoomCount * bucketDays) : 0;
    return { label: bucket.label, rate };
  });

  return {
    activeRoomCount,
    occupiedRoomsNow: roomCountByStatus.get(RoomStatus.OCCUPIED) ?? 0,
    availableRoomsNow: roomCountByStatus.get(RoomStatus.AVAILABLE) ?? 0,
    occupancyRate,
    trend,
  };
}

export async function getReservationReport({ from, to }: DateRange) {
  // Filtered by checkInDate, matching the same convention the Reservations
  // list page's own date-range filter already uses.
  const [statusRows, arrivals, departures] = await Promise.all([
    prisma.reservation.groupBy({
      by: ["status"],
      where: { checkInDate: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    prisma.reservation.count({
      where: { checkInDate: { gte: from, lte: to }, status: { in: REPORTABLE_OCCUPANCY_STATUSES } },
    }),
    prisma.reservation.count({
      where: { checkOutDate: { gte: from, lte: to }, status: { in: REPORTABLE_OCCUPANCY_STATUSES } },
    }),
  ]);

  const countByStatus = new Map(statusRows.map((r) => [r.status, r._count._all]));
  const statusBreakdown = RESERVATION_STATUS_ORDER.map((status) => ({
    status,
    count: countByStatus.get(status) ?? 0,
  }));

  return { statusBreakdown, arrivals, departures };
}

export async function getGuestReport({ from, to }: DateRange) {
  const [totalGuests, newGuests, reservationCountsByGuest, nationalityRows] = await Promise.all([
    prisma.guest.count({ where: { isActive: true } }),
    prisma.guest.count({ where: { isActive: true, createdAt: { gte: from, lt: addDays(to, 1) } } }),
    // All-time: a guest with more than one reservation, ever — not "returned
    // within this specific range," which needs a materially bigger query.
    prisma.reservation.groupBy({ by: ["guestId"], _count: { _all: true } }),
    prisma.guest.groupBy({ by: ["nationality"], where: { isActive: true }, _count: { _all: true } }),
  ]);

  const returningGuests = reservationCountsByGuest.filter((row) => row._count._all > 1).length;

  const nationalityBreakdown = nationalityRows
    .map((row) => ({ nationality: row.nationality ?? "Unknown", count: row._count._all }))
    .sort((a, b) => b.count - a.count);

  return { totalGuests, newGuests, returningGuests, nationalityBreakdown };
}

export async function getHousekeepingReport({ from, to }: DateRange) {
  const where = { createdAt: { gte: from, lt: addDays(to, 1) } };

  const [statusRows, typeRows, priorityRows] = await Promise.all([
    prisma.housekeepingTask.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.housekeepingTask.groupBy({ by: ["type"], where, _count: { _all: true } }),
    prisma.housekeepingTask.groupBy({ by: ["priority"], where, _count: { _all: true } }),
  ]);

  const countByStatus = new Map(statusRows.map((r) => [r.status, r._count._all]));
  // "Completed"/"open" reflect the task's CURRENT status, not whether it was
  // open at some point during the range — the date range only decides which
  // tasks (by createdAt) are counted at all.
  const completed = COMPLETED_TASK_STATUSES.reduce((sum, s) => sum + (countByStatus.get(s) ?? 0), 0);
  const open = OPEN_TASK_STATUSES.reduce((sum, s) => sum + (countByStatus.get(s) ?? 0), 0);

  const byType = (Object.values(HousekeepingTaskType) as HousekeepingTaskType[]).map((type) => ({
    type,
    count: typeRows.find((row) => row.type === type)?._count._all ?? 0,
  }));
  const byPriority = (Object.values(HousekeepingTaskPriority) as HousekeepingTaskPriority[]).map(
    (priority) => ({
      priority,
      count: priorityRows.find((row) => row.priority === priority)?._count._all ?? 0,
    }),
  );

  return { completed, open, byType, byPriority };
}
