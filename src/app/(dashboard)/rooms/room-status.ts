import type { RoomStatus } from "@/generated/prisma/enums";

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  MAINTENANCE: "Maintenance",
  OUT_OF_SERVICE: "Out of service",
};
