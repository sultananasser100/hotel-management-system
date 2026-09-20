import type { Prisma } from "@/generated/prisma/client";

// Serializes payment changes on one reservation (and any concurrent reservation edit or
// status change): whoever holds the lock re-reads the balance and writes before the next
// one can. Payments only take this lock, never the RoomType lock, so they can't deadlock
// with bookings, check-ins or check-outs.
export async function lockReservation(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Reservation" WHERE "id" = ${id} FOR UPDATE`;
}
