"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { NotificationType, ReservationSource, ReservationStatus, Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { todayDateOnly } from "@/lib/dashboard";
import { checkAvailability } from "@/lib/availability";
import { notifyRole } from "@/lib/notifications";
import { lockRoomTypes } from "@/lib/room-type-lock";
import { EDITABLE_STATUSES, INITIAL_STATUSES, MAX_STAY_NIGHTS } from "@/lib/reservation-constants";
import { calculateTotal, nightsBetween, parseDateOnly } from "@/lib/reservation-utils";

export type ReservationFormState = { status: "idle" } | { status: "error"; error: string };

class ReservationError extends Error {}

type Tx = Prisma.TransactionClient;

type ReservationInput = {
  guestId: string;
  roomTypeId: string;
  roomId: string | null;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  source: ReservationSource;
};

const SOURCE_VALUES = new Set<string>(Object.values(ReservationSource));

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parseInput(formData: FormData): ReservationInput {
  const guestId = field(formData, "guestId");
  if (!guestId) throw new ReservationError("Select a guest.");

  const roomTypeId = field(formData, "roomTypeId");
  if (!roomTypeId) throw new ReservationError("Select a room type.");

  const checkIn = parseDateOnly(field(formData, "checkIn"));
  if (!checkIn) throw new ReservationError("Enter a valid check-in date.");
  const checkOut = parseDateOnly(field(formData, "checkOut"));
  if (!checkOut) throw new ReservationError("Enter a valid check-out date.");
  if (checkOut <= checkIn) throw new ReservationError("Check-out must be after check-in.");
  if (nightsBetween(checkIn, checkOut) > MAX_STAY_NIGHTS) {
    throw new ReservationError(`Stays are limited to ${MAX_STAY_NIGHTS} nights.`);
  }

  const adults = Number(field(formData, "adults"));
  if (!Number.isInteger(adults) || adults < 1) {
    throw new ReservationError("At least 1 adult is required.");
  }
  const children = Number(field(formData, "children") || "0");
  if (!Number.isInteger(children) || children < 0) {
    throw new ReservationError("Children must be 0 or more.");
  }

  const source = field(formData, "source");
  if (!SOURCE_VALUES.has(source)) throw new ReservationError("Select a valid source.");

  return {
    guestId,
    roomTypeId,
    roomId: field(formData, "roomId") || null,
    checkIn,
    checkOut,
    adults,
    children,
    source: source as ReservationSource,
  };
}

async function assertGuestActive(tx: Tx, guestId: string) {
  const guest = await tx.guest.findUnique({ where: { id: guestId }, select: { isActive: true } });
  if (!guest?.isActive) throw new ReservationError("Select an active guest.");
}

async function validateStay(tx: Tx, input: ReservationInput, excludeReservationId?: string) {
  const roomType = await tx.roomType.findUnique({ where: { id: input.roomTypeId } });
  if (!roomType) throw new ReservationError("Room type not found.");

  if (input.adults + input.children > roomType.maxOccupancy) {
    throw new ReservationError(
      `${roomType.name} allows at most ${roomType.maxOccupancy} guest${roomType.maxOccupancy === 1 ? "" : "s"}.`,
    );
  }

  const availability = await checkAvailability(tx, {
    roomTypeId: input.roomTypeId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    excludeReservationId,
  });
  if (availability.availableCount < 1) {
    throw new ReservationError(`No ${roomType.name} rooms are available for those dates.`);
  }

  if (input.roomId) {
    const room = await tx.room.findUnique({ where: { id: input.roomId } });
    if (!room || room.roomTypeId !== input.roomTypeId) {
      throw new ReservationError("The selected room doesn't belong to that room type.");
    }
    if (!availability.freeRooms.some((free) => free.id === room.id)) {
      throw new ReservationError(`Room ${room.roomNumber} isn't available for those dates.`);
    }
  }

  const nights = nightsBetween(input.checkIn, input.checkOut);
  return { total: calculateTotal(nights, Number(roomType.basePrice)) };
}

async function nextConfirmationCode(tx: Tx): Promise<string> {
  const rows = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING("confirmationCode" FROM 4) AS INTEGER)) AS max
    FROM "Reservation"
    WHERE "confirmationCode" ~ '^HV-[0-9]+$'`;
  return `HV-${(rows[0]?.max ?? 999) + 1}`;
}

function isConfirmationCodeConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    error.message.includes("confirmationCode")
  );
}

function revalidateReservation(id: string, guestIds: string[]) {
  revalidatePath("/reservations");
  revalidatePath(`/reservations/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/guests");
  for (const guestId of new Set(guestIds)) revalidatePath(`/guests/${guestId}`);
}

async function createReservation(
  userId: string,
  input: ReservationInput,
  status: ReservationStatus,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockRoomTypes(tx, [input.roomTypeId]);
        await assertGuestActive(tx, input.guestId);
        const { total } = await validateStay(tx, input);

        const reservation = await tx.reservation.create({
          data: {
            confirmationCode: await nextConfirmationCode(tx),
            guestId: input.guestId,
            roomTypeId: input.roomTypeId,
            roomId: input.roomId,
            checkInDate: input.checkIn,
            checkOutDate: input.checkOut,
            status,
            adults: input.adults,
            children: input.children,
            source: input.source,
            totalAmount: total,
            createdById: userId,
          },
        });
        await tx.activityLog.create({
          data: {
            userId,
            action: "CREATE_RESERVATION",
            entityType: "Reservation",
            entityId: reservation.id,
            metadata: { confirmationCode: reservation.confirmationCode },
          },
        });
        return { id: reservation.id, guestId: reservation.guestId };
      });
    } catch (error) {
      // Two bookings can race to the same next code; the unique index catches it.
      if (isConfirmationCodeConflict(error) && attempt < 2) continue;
      throw error;
    }
  }
  throw new ReservationError("Couldn't generate a confirmation code. Please try again.");
}

export async function createReservationAction(
  _prevState: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  const user = await requirePermission("reservations", "manage");

  let created: { id: string; guestId: string };
  try {
    const input = parseInput(formData);

    const status = field(formData, "status") as ReservationStatus;
    if (!INITIAL_STATUSES.includes(status)) {
      throw new ReservationError("Initial status must be Pending or Confirmed.");
    }
    if (input.checkIn < todayDateOnly()) {
      throw new ReservationError("Check-in date can't be in the past.");
    }

    created = await createReservation(user.id, input, status);
  } catch (error) {
    if (error instanceof ReservationError) return { status: "error", error: error.message };
    throw error;
  }

  revalidateReservation(created.id, [created.guestId]);
  redirect(`/reservations/${created.id}`);
}

export async function updateReservationAction(
  _prevState: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  const user = await requirePermission("reservations", "manage");

  const id = field(formData, "id");
  if (!id) return { status: "error", error: "Missing reservation id." };

  let guestIds: string[];
  try {
    const input = parseInput(formData);

    guestIds = await prisma.$transaction(async (tx) => {
      const preview = await tx.reservation.findUnique({
        where: { id },
        select: { roomTypeId: true },
      });
      if (!preview) throw new ReservationError("Reservation not found.");

      await lockRoomTypes(tx, [preview.roomTypeId, input.roomTypeId]);

      // Re-read under the lock so the status check can't be stale.
      const existing = await tx.reservation.findUnique({ where: { id } });
      if (!existing) throw new ReservationError("Reservation not found.");
      if (!EDITABLE_STATUSES.includes(existing.status)) {
        throw new ReservationError("Only pending or confirmed reservations can be edited.");
      }

      if (input.guestId !== existing.guestId) await assertGuestActive(tx, input.guestId);

      const checkInChanged = input.checkIn.getTime() !== existing.checkInDate.getTime();
      if (checkInChanged && input.checkIn < todayDateOnly()) {
        throw new ReservationError("Check-in date can't be in the past.");
      }

      const { total } = await validateStay(tx, input, id);

      // Keep the stored price unless the dates or room type changed.
      const repriced =
        checkInChanged ||
        input.checkOut.getTime() !== existing.checkOutDate.getTime() ||
        input.roomTypeId !== existing.roomTypeId;

      await tx.reservation.update({
        where: { id },
        data: {
          guestId: input.guestId,
          roomTypeId: input.roomTypeId,
          roomId: input.roomId,
          checkInDate: input.checkIn,
          checkOutDate: input.checkOut,
          adults: input.adults,
          children: input.children,
          source: input.source,
          ...(repriced ? { totalAmount: total } : {}),
        },
      });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "UPDATE_RESERVATION",
          entityType: "Reservation",
          entityId: id,
          metadata: { confirmationCode: existing.confirmationCode },
        },
      });
      return [existing.guestId, input.guestId];
    });
  } catch (error) {
    if (error instanceof ReservationError) return { status: "error", error: error.message };
    throw error;
  }

  revalidateReservation(id, guestIds);
  redirect(`/reservations/${id}`);
}

export type ReservationActionResult = { error: string } | undefined;

async function transition(
  id: string,
  allowedFrom: ReservationStatus[],
  to: ReservationStatus,
  logAction: string,
  requireStarted = false,
): Promise<ReservationActionResult> {
  const user = await requirePermission("reservations", "manage");

  let guestId: string;
  try {
    guestId = await prisma.$transaction(async (tx) => {
      const existing = await tx.reservation.findUnique({
        where: { id },
        select: { status: true, checkInDate: true, confirmationCode: true, guestId: true },
      });
      if (!existing) throw new ReservationError("Reservation not found.");
      if (!allowedFrom.includes(existing.status)) {
        throw new ReservationError(
          "This reservation's status has changed. Refresh the page and try again.",
        );
      }
      if (requireStarted && existing.checkInDate > todayDateOnly()) {
        throw new ReservationError(
          "A reservation can only be marked as a no-show on or after its check-in date.",
        );
      }

      // Guarded write so a concurrent change can't be overwritten.
      const result = await tx.reservation.updateMany({
        where: { id, status: existing.status },
        data: { status: to },
      });
      if (result.count === 0) {
        throw new ReservationError(
          "This reservation's status has changed. Refresh the page and try again.",
        );
      }

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: logAction,
          entityType: "Reservation",
          entityId: id,
          metadata: { confirmationCode: existing.confirmationCode },
        },
      });

      if (to === ReservationStatus.CANCELLED) {
        await notifyRole(tx, Role.ADMIN, {
          type: NotificationType.RESERVATION,
          title: "Reservation cancelled",
          message: `Reservation ${existing.confirmationCode} was cancelled.`,
          relatedEntityType: "Reservation",
          relatedEntityId: id,
        });
      } else if (to === ReservationStatus.NO_SHOW) {
        await notifyRole(tx, Role.ADMIN, {
          type: NotificationType.RESERVATION,
          title: "Reservation marked no-show",
          message: `Reservation ${existing.confirmationCode} was marked as a no-show.`,
          relatedEntityType: "Reservation",
          relatedEntityId: id,
        });
      }

      return existing.guestId;
    });
  } catch (error) {
    if (error instanceof ReservationError) return { error: error.message };
    throw error;
  }

  revalidateReservation(id, [guestId]);
  return undefined;
}

export async function confirmReservationAction(id: string): Promise<ReservationActionResult> {
  return transition(
    id,
    [ReservationStatus.PENDING],
    ReservationStatus.CONFIRMED,
    "CONFIRM_RESERVATION",
  );
}

export async function cancelReservationAction(id: string): Promise<ReservationActionResult> {
  return transition(id, EDITABLE_STATUSES, ReservationStatus.CANCELLED, "CANCEL_RESERVATION");
}

export async function markNoShowAction(id: string): Promise<ReservationActionResult> {
  return transition(
    id,
    [ReservationStatus.CONFIRMED],
    ReservationStatus.NO_SHOW,
    "NO_SHOW_RESERVATION",
    true,
  );
}
