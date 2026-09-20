import { prisma } from "@/lib/prisma";

export async function getRoomTypes() {
  const roomTypes = await prisma.roomType.findMany({
    include: { _count: { select: { rooms: true } } },
    orderBy: { name: "asc" },
  });

  // Prisma Decimal instances can't cross the Server -> Client Component
  // boundary, so expose the price as a plain number.
  return roomTypes.map((roomType) => ({
    ...roomType,
    basePrice: Number(roomType.basePrice),
  }));
}

export type RoomTypeListItem = Awaited<ReturnType<typeof getRoomTypes>>[number];
