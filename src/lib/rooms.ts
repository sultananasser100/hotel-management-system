import { prisma } from "@/lib/prisma";

export async function getRooms() {
  return prisma.room.findMany({
    include: { roomType: { select: { id: true, name: true } } },
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  });
}

export async function getRoomTypeOptions() {
  return prisma.roomType.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type RoomListItem = Awaited<ReturnType<typeof getRooms>>[number];
export type RoomTypeOption = Awaited<ReturnType<typeof getRoomTypeOptions>>[number];
