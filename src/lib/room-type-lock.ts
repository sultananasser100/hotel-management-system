import type { Prisma } from "@/generated/prisma/client";

// Serializes concurrent bookings, check-ins and check-outs of the same room type:
// whoever holds the lock validates and writes before the next one can validate.
// (A database exclusion constraint would be the stronger guarantee — deferred to hardening.)
export async function lockRoomTypes(tx: Prisma.TransactionClient, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) {
    await tx.$queryRaw`SELECT "id" FROM "RoomType" WHERE "id" = ${id} FOR UPDATE`;
  }
}
