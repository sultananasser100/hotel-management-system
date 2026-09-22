import type { Prisma } from "@/generated/prisma/client";

// Serializes housekeeping changes on one room. Housekeeping only ever takes this row lock,
// never the RoomType lock that bookings, check-ins and check-outs take first, so it can't
// deadlock with them (checkout takes RoomType, then updates this room's row).
export async function lockRoom(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id" = ${id} FOR UPDATE`;
}
