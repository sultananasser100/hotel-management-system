import type { Prisma } from "@/generated/prisma/client";
import { PaymentStatus, ReservationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { todayDateOnly } from "@/lib/dashboard";
import { formatDateOnly, formatTimestamp } from "@/lib/format";
import { checkInTimingBlocker } from "@/lib/front-desk-rules";
import { EDITABLE_STATUSES, RESERVATIONS_PAGE_SIZE } from "@/lib/reservation-constants";
import { nightsBetween, toDateInputValue } from "@/lib/reservation-utils";

export type ReservationFilters = {
  query: string;
  status: ReservationStatus | "";
  from: Date | null;
  to: Date | null;
  page: number;
};

function buildWhere({ query, status, from, to }: ReservationFilters): Prisma.ReservationWhereInput {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const checkIn: Prisma.DateTimeFilter = {};
  if (from) checkIn.gte = from;
  if (to) checkIn.lte = to;

  return {
    ...(status ? { status } : {}),
    ...(from || to ? { checkInDate: checkIn } : {}),
    AND: words.map((word) => ({
      OR: [
        { confirmationCode: { contains: word, mode: "insensitive" as const } },
        { guest: { firstName: { contains: word, mode: "insensitive" as const } } },
        { guest: { lastName: { contains: word, mode: "insensitive" as const } } },
        { room: { roomNumber: { contains: word, mode: "insensitive" as const } } },
      ],
    })),
  };
}

// Everything the list needs is pre-formatted/plain so it can cross into a Client Component.
export async function getReservations(filters: ReservationFilters) {
  const where = buildWhere(filters);
  const total = await prisma.reservation.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / RESERVATIONS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), totalPages);

  const rows = await prisma.reservation.findMany({
    where,
    include: {
      guest: { select: { id: true, firstName: true, lastName: true } },
      roomType: { select: { name: true } },
      room: { select: { roomNumber: true } },
    },
    orderBy: [{ checkInDate: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * RESERVATIONS_PAGE_SIZE,
    take: RESERVATIONS_PAGE_SIZE,
  });

  const today = todayDateOnly();
  const items = rows.map((r) => {
    const isConfirmed = r.status === ReservationStatus.CONFIRMED;
    const checkInBlockedReason = isConfirmed
      ? checkInTimingBlocker(r.status, r.checkInDate, r.checkOutDate, today)
      : null;
    return {
      id: r.id,
      confirmationCode: r.confirmationCode,
      status: r.status,
      guestId: r.guest.id,
      guestName: `${r.guest.firstName} ${r.guest.lastName}`,
      roomTypeName: r.roomType.name,
      roomNumber: r.room?.roomNumber ?? null,
      checkInLabel: formatDateOnly(r.checkInDate),
      checkOutLabel: formatDateOnly(r.checkOutDate),
      nights: nightsBetween(r.checkInDate, r.checkOutDate),
      totalAmount: Number(r.totalAmount),
      canEdit: EDITABLE_STATUSES.includes(r.status),
      canMarkNoShow: r.status === ReservationStatus.CONFIRMED && r.checkInDate <= today,
      canCheckIn: isConfirmed && checkInBlockedReason === null,
      checkInBlockedReason,
      canCheckOut: r.status === ReservationStatus.CHECKED_IN,
    };
  });

  return { items, total, page, totalPages };
}

export type ReservationListItem = Awaited<ReturnType<typeof getReservations>>["items"][number];

export async function getReservationById(id: string) {
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      guest: true,
      roomType: true,
      room: true,
      createdBy: { select: { name: true } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!r) return null;

  const today = todayDateOnly();
  const nights = nightsBetween(r.checkInDate, r.checkOutDate);
  const detailCheckInBlockedReason = checkInTimingBlocker(
    r.status,
    r.checkInDate,
    r.checkOutDate,
    today,
  );
  const totalAmount = Number(r.totalAmount);
  const payments = r.payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    method: p.method,
    status: p.status,
    dateLabel: formatDateOnly(p.paidAt ?? p.createdAt),
  }));
  const paidAmount = payments
    .filter((p) => p.status === PaymentStatus.COMPLETED)
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    id: r.id,
    confirmationCode: r.confirmationCode,
    status: r.status,
    source: r.source,
    adults: r.adults,
    children: r.children,
    checkIn: toDateInputValue(r.checkInDate),
    checkOut: toDateInputValue(r.checkOutDate),
    checkInLabel: formatDateOnly(r.checkInDate),
    checkOutLabel: formatDateOnly(r.checkOutDate),
    nights,
    totalAmount,
    effectiveRate: nights > 0 ? totalAmount / nights : 0,
    actualCheckInLabel: r.actualCheckInAt ? formatTimestamp(r.actualCheckInAt) : null,
    actualCheckOutLabel: r.actualCheckOutAt ? formatTimestamp(r.actualCheckOutAt) : null,
    guest: {
      id: r.guest.id,
      name: `${r.guest.firstName} ${r.guest.lastName}`,
      email: r.guest.email,
      phone: r.guest.phone,
      isActive: r.guest.isActive,
    },
    roomTypeId: r.roomType.id,
    roomTypeName: r.roomType.name,
    room: r.room
      ? { id: r.room.id, roomNumber: r.room.roomNumber, isActive: r.room.isActive }
      : null,
    createdByName: r.createdBy.name,
    createdAtLabel: formatDateOnly(r.createdAt),
    updatedAtLabel: formatDateOnly(r.updatedAt),
    payments,
    paidAmount,
    balance: Math.max(0, totalAmount - paidAmount),
    canEdit: EDITABLE_STATUSES.includes(r.status),
    canMarkNoShow: r.status === ReservationStatus.CONFIRMED && r.checkInDate <= today,
    canCheckIn: detailCheckInBlockedReason === null && r.status === ReservationStatus.CONFIRMED,
    checkInBlockedReason:
      r.status === ReservationStatus.CONFIRMED ? detailCheckInBlockedReason : null,
    canCheckOut: r.status === ReservationStatus.CHECKED_IN,
  };
}

export type ReservationDetail = NonNullable<Awaited<ReturnType<typeof getReservationById>>>;

export async function getReservationRoomTypes() {
  const roomTypes = await prisma.roomType.findMany({
    select: { id: true, name: true, basePrice: true, maxOccupancy: true },
    orderBy: { name: "asc" },
  });
  // Prisma Decimal can't cross the Server -> Client Component boundary.
  return roomTypes.map((type) => ({ ...type, basePrice: Number(type.basePrice) }));
}

export type ReservationRoomType = Awaited<ReturnType<typeof getReservationRoomTypes>>[number];

export async function getActiveGuestOption(id: string) {
  const guest = await prisma.guest.findFirst({
    where: { id, isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
  return guest ? { id: guest.id, name: `${guest.firstName} ${guest.lastName}` } : null;
}
