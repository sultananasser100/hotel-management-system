import type { Prisma } from "@/generated/prisma/client";
import { OCCUPYING_STATUSES, UNBOOKABLE_ROOM_STATUSES } from "@/lib/reservation-constants";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Db = Prisma.TransactionClient;

export type AvailabilityParams = {
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  // Ignore this reservation when editing it, so it doesn't conflict with itself.
  excludeReservationId?: string;
};

/**
 * A stay covers the nights from check-in up to (not including) check-out, so
 * same-day turnover is allowed. For each night, the reservations that hold a
 * room of this type (PENDING/CONFIRMED/CHECKED_IN, assigned or not) must leave
 * at least one bookable room. Rooms in MAINTENANCE/OUT_OF_SERVICE or inactive
 * are not bookable. `freeRooms` are bookable rooms with no overlapping
 * reservation assigned to them.
 */
export async function checkAvailability(db: Db, params: AvailabilityParams) {
  const { roomTypeId, checkIn, checkOut, excludeReservationId } = params;

  const bookableRooms = await db.room.findMany({
    where: {
      roomTypeId,
      isActive: true,
      status: { notIn: UNBOOKABLE_ROOM_STATUSES },
    },
    select: { id: true, roomNumber: true, floor: true, housekeepingStatus: true },
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  });

  const overlapping = await db.reservation.findMany({
    where: {
      roomTypeId,
      status: { in: OCCUPYING_STATUSES },
      checkInDate: { lt: checkOut },
      checkOutDate: { gt: checkIn },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    select: { checkInDate: true, checkOutDate: true, roomId: true },
  });

  let peak = 0;
  for (let night = checkIn.getTime(); night < checkOut.getTime(); night += MS_PER_DAY) {
    const count = overlapping.filter(
      (r) => r.checkInDate.getTime() <= night && r.checkOutDate.getTime() > night,
    ).length;
    peak = Math.max(peak, count);
  }

  const takenRoomIds = new Set(overlapping.flatMap((r) => (r.roomId ? [r.roomId] : [])));

  return {
    bookableCount: bookableRooms.length,
    availableCount: Math.max(0, bookableRooms.length - peak),
    freeRooms: bookableRooms.filter((room) => !takenRoomIds.has(room.id)),
  };
}
