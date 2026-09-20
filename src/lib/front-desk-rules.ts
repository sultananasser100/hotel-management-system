import { HousekeepingStatus, ReservationStatus } from "@/generated/prisma/enums";
import { formatDateOnly } from "@/lib/format";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const HOUSEKEEPING_STATUS_LABEL: Record<HousekeepingStatus, string> = {
  CLEAN: "Clean",
  DIRTY: "Dirty",
  IN_PROGRESS: "Being cleaned",
  INSPECTED: "Inspected",
};

// Rooms in these states are ready for a guest; anything else gets a warning at check-in.
export const READY_HOUSEKEEPING_STATUSES: HousekeepingStatus[] = [
  HousekeepingStatus.CLEAN,
  HousekeepingStatus.INSPECTED,
];

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// Status and date rules only: check-in is allowed when checkInDate <= today < checkOutDate.
export function checkInTimingBlocker(
  status: ReservationStatus,
  checkInDate: Date,
  checkOutDate: Date,
  today: Date,
): string | null {
  switch (status) {
    case ReservationStatus.CONFIRMED:
      break;
    case ReservationStatus.PENDING:
      return "Confirm the reservation before checking in.";
    case ReservationStatus.CHECKED_IN:
      return "This reservation is already checked in.";
    case ReservationStatus.CHECKED_OUT:
      return "This reservation has already been checked out.";
    case ReservationStatus.CANCELLED:
      return "Cancelled reservations can't be checked in.";
    case ReservationStatus.NO_SHOW:
      return "No-show reservations can't be checked in.";
  }

  if (checkInDate > today) {
    return `Check-in opens on ${formatDateOnly(checkInDate)}.`;
  }
  if (checkOutDate <= today) {
    return `The stay ended on ${formatDateOnly(checkOutDate)}. Mark it as a no-show or edit the dates.`;
  }
  return null;
}

export function checkInBlockers(input: {
  status: ReservationStatus;
  checkInDate: Date;
  checkOutDate: Date;
  today: Date;
  guestActive: boolean;
  adults: number;
  children: number;
  maxOccupancy: number;
}): string[] {
  const blockers: string[] = [];

  const timing = checkInTimingBlocker(
    input.status,
    input.checkInDate,
    input.checkOutDate,
    input.today,
  );
  if (timing) blockers.push(timing);

  if (!input.guestActive) blockers.push("The guest is inactive. Restore the guest first.");
  if (input.adults < 1) blockers.push("The reservation needs at least 1 adult. Edit it first.");
  if (input.adults + input.children > input.maxOccupancy) {
    blockers.push(
      `The party exceeds the room type's maximum of ${input.maxOccupancy}. Edit the reservation first.`,
    );
  }
  return blockers;
}

export function departureNote(checkOutDate: Date, today: Date): string {
  const days = daysBetween(today, checkOutDate);
  if (days === 0) return "Departs today";
  if (days > 0) {
    return `Early departure — scheduled for ${formatDateOnly(checkOutDate)} (${days} night${days === 1 ? "" : "s"} early)`;
  }
  const overdue = -days;
  return `Overdue — was due out ${overdue} day${overdue === 1 ? "" : "s"} ago (${formatDateOnly(checkOutDate)})`;
}

export function lateArrivalDays(checkInDate: Date, today: Date): number {
  return Math.max(0, daysBetween(checkInDate, today));
}

export function overdueDays(checkOutDate: Date, today: Date): number {
  return Math.max(0, daysBetween(checkOutDate, today));
}
