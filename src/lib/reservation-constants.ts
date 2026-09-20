import { ReservationSource, ReservationStatus, RoomStatus } from "@/generated/prisma/enums";

export const MAX_STAY_NIGHTS = 30;
export const RESERVATIONS_PAGE_SIZE = 15;

// Statuses that hold a room for their dates. CHECKED_OUT, CANCELLED and NO_SHOW release it.
export const OCCUPYING_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

// Only these can be edited or cancelled here; CHECKED_IN/CHECKED_OUT belong to Phase 9.
export const EDITABLE_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
];

export const INITIAL_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
];

// OCCUPIED/RESERVED are derived from reservations, so only these two block booking.
export const UNBOOKABLE_ROOM_STATUSES: RoomStatus[] = [
  RoomStatus.MAINTENANCE,
  RoomStatus.OUT_OF_SERVICE,
];

export const SOURCE_LABEL: Record<ReservationSource, string> = {
  WALK_IN: "Walk-in",
  PHONE: "Phone",
  ONLINE: "Online",
  OTA: "OTA",
};
