import { prisma } from "@/lib/prisma";
import { RoomStatus, ReservationStatus } from "@/generated/prisma/enums";

export const ROOM_STATUS_ORDER: RoomStatus[] = [
  RoomStatus.AVAILABLE,
  RoomStatus.OCCUPIED,
  RoomStatus.RESERVED,
  RoomStatus.MAINTENANCE,
  RoomStatus.OUT_OF_SERVICE,
];

export const RESERVATION_STATUS_ORDER: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKED_OUT,
  ReservationStatus.CANCELLED,
  ReservationStatus.NO_SHOW,
];

// Reservations relevant to "today's arrivals/departures": bookings still on
// track to happen (CONFIRMED) or already in progress (CHECKED_IN) — so a
// guest who has already checked in today still shows up. PENDING (not yet
// confirmed), CANCELLED, and NO_SHOW are excluded.
const ARRIVAL_DEPARTURE_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

function todayDateOnly(): Date {
  // checkInDate/checkOutDate are Postgres `date` columns (no time/timezone).
  // Matches prisma/seed.ts's daysFromNow() convention (UTC-midnight of the
  // current UTC calendar date) so "today" lines up with how those columns
  // are populated, without introducing a separate timezone concept.
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardData() {
  const today = todayDateOnly();

  const [
    roomStatusCounts,
    reservationStatusCounts,
    todaysArrivalsRaw,
    todaysDeparturesRaw,
    recentActivityRaw,
  ] = await Promise.all([
    prisma.room.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.reservation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.reservation.findMany({
      where: { checkInDate: today, status: { in: ARRIVAL_DEPARTURE_STATUSES } },
      include: { guest: true, room: true },
      orderBy: [{ guest: { lastName: "asc" } }, { guest: { firstName: "asc" } }],
    }),
    prisma.reservation.findMany({
      where: { checkOutDate: today, status: { in: ARRIVAL_DEPARTURE_STATUSES } },
      include: { guest: true, room: true },
      orderBy: [{ guest: { lastName: "asc" } }, { guest: { firstName: "asc" } }],
    }),
    prisma.activityLog.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { user: true },
    }),
  ]);

  const roomCountByStatus = new Map(roomStatusCounts.map((r) => [r.status, r._count._all]));
  const reservationCountByStatus = new Map(
    reservationStatusCounts.map((r) => [r.status, r._count._all]),
  );

  const totalRooms = roomStatusCounts.reduce((sum, r) => sum + r._count._all, 0);

  const toArrivalDeparture = (r: (typeof todaysArrivalsRaw)[number]) => ({
    id: r.id,
    confirmationCode: r.confirmationCode,
    status: r.status,
    guestName: `${r.guest.firstName} ${r.guest.lastName}`,
    roomNumber: r.room?.roomNumber ?? null,
  });

  return {
    totalRooms,
    availableRooms: roomCountByStatus.get(RoomStatus.AVAILABLE) ?? 0,
    occupiedRooms: roomCountByStatus.get(RoomStatus.OCCUPIED) ?? 0,
    roomStatusBreakdown: ROOM_STATUS_ORDER.map((status) => ({
      status,
      count: roomCountByStatus.get(status) ?? 0,
    })),
    reservationStatusBreakdown: RESERVATION_STATUS_ORDER.map((status) => ({
      status,
      count: reservationCountByStatus.get(status) ?? 0,
    })),
    todaysArrivals: todaysArrivalsRaw.map(toArrivalDeparture),
    todaysDepartures: todaysDeparturesRaw.map(toArrivalDeparture),
    recentActivity: recentActivityRaw.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      userName: entry.user?.name ?? null,
      createdAt: entry.createdAt,
    })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
export type ArrivalDeparture = DashboardData["todaysArrivals"][number];
