import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { checkAvailability } from "@/lib/availability";
import { MAX_STAY_NIGHTS } from "@/lib/reservation-constants";
import { calculateTotal, nightsBetween, parseDateOnly } from "@/lib/reservation-utils";

// Read-only lookup used by the reservation form. (Server Actions are dispatched
// one at a time, so reads go through a route handler instead.)
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "reservations", "manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const roomTypeId = params.get("roomTypeId") ?? "";
  const checkIn = parseDateOnly(params.get("checkIn") ?? "");
  const checkOut = parseDateOnly(params.get("checkOut") ?? "");
  const excludeReservationId = params.get("excludeId") ?? undefined;

  if (!roomTypeId || !checkIn || !checkOut) {
    return Response.json({ error: "Room type and valid dates are required." }, { status: 400 });
  }
  if (checkOut <= checkIn) {
    return Response.json({ error: "Check-out must be after check-in." }, { status: 400 });
  }
  const nights = nightsBetween(checkIn, checkOut);
  if (nights > MAX_STAY_NIGHTS) {
    return Response.json(
      { error: `Stays are limited to ${MAX_STAY_NIGHTS} nights.` },
      { status: 400 },
    );
  }

  const roomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    select: { basePrice: true },
  });
  if (!roomType) {
    return Response.json({ error: "Room type not found." }, { status: 404 });
  }

  const availability = await checkAvailability(prisma, {
    roomTypeId,
    checkIn,
    checkOut,
    excludeReservationId,
  });
  const nightlyRate = Number(roomType.basePrice);

  return Response.json({
    nights,
    nightlyRate,
    total: calculateTotal(nights, nightlyRate),
    bookableCount: availability.bookableCount,
    availableCount: availability.availableCount,
    rooms: availability.freeRooms,
  });
}
