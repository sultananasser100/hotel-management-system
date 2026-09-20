import type { HousekeepingStatus, RoomStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { ReservationStatus, RoomStatus as RoomStatusValues } from "@/generated/prisma/enums";
import { summarizePayments } from "@/lib/payment-balance";
import { prisma } from "@/lib/prisma";
import { checkAvailability } from "@/lib/availability";
import { todayDateOnly } from "@/lib/dashboard";
import { formatDateOnly, formatTimestamp } from "@/lib/format";
import {
  READY_HOUSEKEEPING_STATUSES,
  HOUSEKEEPING_STATUS_LABEL,
  checkInBlockers,
  departureNote,
  lateArrivalDays,
  overdueDays,
} from "@/lib/front-desk-rules";
import { UNBOOKABLE_ROOM_STATUSES } from "@/lib/reservation-constants";
import { nightsBetween } from "@/lib/reservation-utils";

type Db = Prisma.TransactionClient;

export type RoomOption = {
  id: string;
  roomNumber: string;
  floor: number;
  housekeepingStatus: HousekeepingStatus;
};

function maskDocumentNumber(value: string): string {
  return value.length <= 4 ? "••••" : `•••• ${value.slice(-4)}`;
}

/**
 * Rooms this reservation can be checked into: bookable for its dates (Phase 8's
 * availability rules, excluding the reservation itself) and with no other guest
 * currently in-house. `assigned` describes the reservation's own room, if any,
 * with the reason it can't be used.
 */
export async function getCheckInRoomState(
  db: Db,
  reservation: {
    id: string;
    roomId: string | null;
    roomTypeId: string;
    checkInDate: Date;
    checkOutDate: Date;
  },
) {
  const availability = await checkAvailability(db, {
    roomTypeId: reservation.roomTypeId,
    checkIn: reservation.checkInDate,
    checkOut: reservation.checkOutDate,
    excludeReservationId: reservation.id,
  });

  const roomIds = availability.freeRooms.map((room) => room.id);
  if (reservation.roomId) roomIds.push(reservation.roomId);

  const inHouse = await db.reservation.findMany({
    where: {
      status: ReservationStatus.CHECKED_IN,
      roomId: { in: roomIds },
      id: { not: reservation.id },
    },
    select: { roomId: true, confirmationCode: true },
  });
  const occupiedBy = new Map(inHouse.map((r) => [r.roomId, r.confirmationCode]));

  const options: RoomOption[] = availability.freeRooms
    .filter((room) => !occupiedBy.has(room.id))
    .sort(
      (a, b) =>
        Number(READY_HOUSEKEEPING_STATUSES.includes(b.housekeepingStatus)) -
          Number(READY_HOUSEKEEPING_STATUSES.includes(a.housekeepingStatus)) ||
        a.roomNumber.localeCompare(b.roomNumber),
    );

  let assigned: { room: RoomOption & { status: RoomStatus }; problem: string | null } | null = null;
  if (reservation.roomId) {
    const room = await db.room.findUnique({ where: { id: reservation.roomId } });
    if (room) {
      let problem: string | null = null;
      if (!room.isActive) {
        problem = `Room ${room.roomNumber} is inactive.`;
      } else if (UNBOOKABLE_ROOM_STATUSES.includes(room.status)) {
        problem = `Room ${room.roomNumber} is under maintenance or out of service.`;
      } else if (occupiedBy.has(room.id)) {
        problem = `Room ${room.roomNumber} is still occupied by ${occupiedBy.get(room.id)}. Check that guest out first.`;
      } else if (!availability.freeRooms.some((free) => free.id === room.id)) {
        problem = `Room ${room.roomNumber} is booked by another reservation for these dates.`;
      }
      assigned = {
        room: {
          id: room.id,
          roomNumber: room.roomNumber,
          floor: room.floor,
          housekeepingStatus: room.housekeepingStatus,
          status: room.status,
        },
        problem,
      };
    }
  }

  return { assigned, options };
}

export type FrontDeskInfo = {
  reservation: {
    id: string;
    confirmationCode: string;
    status: ReservationStatus;
    guestName: string;
    roomTypeName: string;
    roomNumber: string | null;
    checkInLabel: string;
    checkOutLabel: string;
    nights: number;
    adults: number;
    children: number;
  };
  // Set when the reservation is CONFIRMED (check-in) / CHECKED_IN (check-out).
  checkIn: {
    blockers: string[];
    warnings: string[];
    needsRoomChoice: boolean;
    assignedRoom: RoomOption | null;
    roomOptions: RoomOption[];
    idOnFile: { type: string; masked: string } | null;
  } | null;
  checkOut: {
    departure: string;
    roomNumber: string | null;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    // Paid beyond the total (overpaid); shown as information only.
    credit: number;
    // Whether the current user may record payments (controls the "Record a payment" link).
    canRecordPayment: boolean;
  } | null;
  // Explains why neither action applies (other statuses).
  unavailableReason: string | null;
};

export async function getFrontDeskInfo(
  id: string,
  access: { canRecordPayment: boolean },
): Promise<FrontDeskInfo | null> {
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: { guest: true, roomType: true, room: true, payments: true },
  });
  if (!r) return null;

  const today = todayDateOnly();
  const nights = nightsBetween(r.checkInDate, r.checkOutDate);

  const reservation: FrontDeskInfo["reservation"] = {
    id: r.id,
    confirmationCode: r.confirmationCode,
    status: r.status,
    guestName: `${r.guest.firstName} ${r.guest.lastName}`,
    roomTypeName: r.roomType.name,
    roomNumber: r.room?.roomNumber ?? null,
    checkInLabel: formatDateOnly(r.checkInDate),
    checkOutLabel: formatDateOnly(r.checkOutDate),
    nights,
    adults: r.adults,
    children: r.children,
  };

  if (r.status === ReservationStatus.CHECKED_IN) {
    const payment = summarizePayments({
      status: r.status,
      totalAmount: Number(r.totalAmount),
      payments: r.payments.map((p) => ({ amount: Number(p.amount), status: p.status })),
    });
    return {
      reservation,
      checkIn: null,
      checkOut: {
        departure: departureNote(r.checkOutDate, today),
        roomNumber: r.room?.roomNumber ?? null,
        totalAmount: payment.total,
        paidAmount: payment.paid,
        balance: payment.balance,
        credit: payment.credit,
        canRecordPayment: access.canRecordPayment,
      },
      unavailableReason: null,
    };
  }

  const blockers = checkInBlockers({
    status: r.status,
    checkInDate: r.checkInDate,
    checkOutDate: r.checkOutDate,
    today,
    guestActive: r.guest.isActive,
    adults: r.adults,
    children: r.children,
    maxOccupancy: r.roomType.maxOccupancy,
  });

  if (r.status !== ReservationStatus.CONFIRMED) {
    return { reservation, checkIn: null, checkOut: null, unavailableReason: blockers[0] ?? null };
  }

  const { assigned, options } = await getCheckInRoomState(prisma, r);
  const usable = assigned !== null && assigned.problem === null ? assigned : null;
  const warnings: string[] = [];

  const late = lateArrivalDays(r.checkInDate, today);
  if (late > 0) warnings.push(`Late arrival: expected ${late} day${late === 1 ? "" : "s"} ago.`);

  if (assigned && assigned.problem) {
    warnings.push(`${assigned.problem} Choose another room below.`);
  }
  if (usable) {
    if (!READY_HOUSEKEEPING_STATUSES.includes(usable.room.housekeepingStatus)) {
      warnings.push(
        `Room ${usable.room.roomNumber} is not ready: ${HOUSEKEEPING_STATUS_LABEL[usable.room.housekeepingStatus].toLowerCase()}.`,
      );
    }
    if (usable.room.status === RoomStatusValues.OCCUPIED) {
      warnings.push(
        `Room ${usable.room.roomNumber} was marked Occupied but has no in-house guest; its status will be corrected.`,
      );
    }
  }

  if (!usable && options.length === 0) {
    blockers.push(`No ${r.roomType.name} room is free to check into right now.`);
  }

  return {
    reservation,
    checkIn: {
      blockers,
      warnings,
      needsRoomChoice: !usable,
      assignedRoom: usable
        ? {
            id: usable.room.id,
            roomNumber: usable.room.roomNumber,
            floor: usable.room.floor,
            housekeepingStatus: usable.room.housekeepingStatus,
          }
        : null,
      roomOptions: options,
      idOnFile:
        r.guest.idDocumentType && r.guest.idDocumentNumber
          ? {
              type: r.guest.idDocumentType,
              masked: maskDocumentNumber(r.guest.idDocumentNumber),
            }
          : null,
    },
    checkOut: null,
    unavailableReason: null,
  };
}

export type FrontDeskBoardItem = {
  id: string;
  confirmationCode: string;
  guestId: string;
  guestName: string;
  roomTypeName: string;
  roomNumber: string | null;
  checkInLabel: string;
  checkOutLabel: string;
  nights: number;
  partyLabel: string;
  // Arrivals: days past the expected check-in date. In-house: days past the expected check-out.
  lateDays: number;
  departsToday: boolean;
  actualCheckInLabel: string | null;
};

export async function getFrontDeskBoard() {
  const today = todayDateOnly();
  const include = {
    guest: { select: { id: true, firstName: true, lastName: true } },
    roomType: { select: { name: true } },
    room: { select: { roomNumber: true } },
  } as const;
  const dueWindow = { checkInDate: { lte: today }, checkOutDate: { gt: today } };

  const [arrivalRows, pendingRows, inHouseRows] = await Promise.all([
    prisma.reservation.findMany({
      where: { status: ReservationStatus.CONFIRMED, ...dueWindow },
      include,
      orderBy: [{ checkInDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.reservation.findMany({
      where: { status: ReservationStatus.PENDING, ...dueWindow },
      include,
      orderBy: [{ checkInDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.reservation.findMany({
      where: { status: ReservationStatus.CHECKED_IN },
      include,
      orderBy: [{ checkOutDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  type Row = (typeof arrivalRows)[number];
  const toItem = (r: Row, lateDays: number): FrontDeskBoardItem => ({
    id: r.id,
    confirmationCode: r.confirmationCode,
    guestId: r.guest.id,
    guestName: `${r.guest.firstName} ${r.guest.lastName}`,
    roomTypeName: r.roomType.name,
    roomNumber: r.room?.roomNumber ?? null,
    checkInLabel: formatDateOnly(r.checkInDate),
    checkOutLabel: formatDateOnly(r.checkOutDate),
    nights: nightsBetween(r.checkInDate, r.checkOutDate),
    partyLabel: `${r.adults} adult${r.adults === 1 ? "" : "s"}${
      r.children > 0 ? `, ${r.children} child${r.children === 1 ? "" : "ren"}` : ""
    }`,
    lateDays,
    departsToday: r.checkOutDate.getTime() === today.getTime(),
    actualCheckInLabel: r.actualCheckInAt ? formatTimestamp(r.actualCheckInAt) : null,
  });

  return {
    arrivals: arrivalRows.map((r) => toItem(r, lateArrivalDays(r.checkInDate, today))),
    pendingArrivals: pendingRows.map((r) => toItem(r, lateArrivalDays(r.checkInDate, today))),
    inHouse: inHouseRows.map((r) => toItem(r, overdueDays(r.checkOutDate, today))),
  };
}
