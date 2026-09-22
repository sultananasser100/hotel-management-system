"use server";

import { revalidatePath } from "next/cache";
import {
  HousekeepingStatus,
  NotificationType,
  ReservationStatus,
  RoomStatus,
  Role,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { todayDateOnly } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/format";
import { getCheckInRoomState } from "@/lib/front-desk";
import { getPaymentSummary } from "@/lib/payments";
import { ensureOpenCleaningTask } from "@/lib/housekeeping";
import { notifyRole } from "@/lib/notifications";
import { checkInBlockers } from "@/lib/front-desk-rules";
import { ID_DOCUMENT_TYPES } from "@/lib/guest-constants";
import { UNBOOKABLE_ROOM_STATUSES } from "@/lib/reservation-constants";
import { lockRoomTypes } from "@/lib/room-type-lock";

export type CheckInFormState =
  { status: "idle" } | { status: "error"; error: string } | { status: "success"; message: string };

export type CheckOutResult =
  { status: "error"; error: string } | { status: "success"; message: string };

class FrontDeskError extends Error {}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function revalidateFrontDesk(reservationId: string, guestId: string) {
  revalidatePath("/checkin-checkout");
  revalidatePath("/reservations");
  revalidatePath(`/reservations/${reservationId}`);
  revalidatePath("/dashboard");
  revalidatePath("/rooms");
  revalidatePath("/housekeeping");
  revalidatePath(`/guests/${guestId}`);
}

export async function checkInReservationAction(
  _prevState: CheckInFormState,
  formData: FormData,
): Promise<CheckInFormState> {
  const user = await requirePermission("checkInOut", "manage");

  const reservationId = field(formData, "reservationId");
  if (!reservationId) return { status: "error", error: "Missing reservation id." };
  if (formData.get("idVerified") !== "on") {
    return { status: "error", error: "Confirm that you verified the guest's ID document." };
  }

  const roomIdInput = field(formData, "roomId");
  const idTypeInput = field(formData, "idDocumentType");
  const idNumberInput = field(formData, "idDocumentNumber");

  let result: { confirmationCode: string; roomNumber: string; guestId: string };
  try {
    result = await prisma.$transaction(async (tx) => {
      const preview = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: { roomTypeId: true },
      });
      if (!preview) throw new FrontDeskError("Reservation not found.");

      // Same lock as Phase 8 bookings: everything below is validated under it.
      await lockRoomTypes(tx, [preview.roomTypeId]);

      const r = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { guest: true, roomType: true },
      });
      if (!r) throw new FrontDeskError("Reservation not found.");

      const blockers = checkInBlockers({
        status: r.status,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        today: todayDateOnly(),
        guestActive: r.guest.isActive,
        adults: r.adults,
        children: r.children,
        maxOccupancy: r.roomType.maxOccupancy,
      });
      if (blockers.length > 0) throw new FrontDeskError(blockers[0]);

      // Guest ID: required. Captured here when it isn't on file yet.
      let idUpdate: { idDocumentType: string; idDocumentNumber: string } | null = null;
      if (!r.guest.idDocumentType || !r.guest.idDocumentNumber) {
        if (!idTypeInput || !idNumberInput) {
          throw new FrontDeskError("The guest's ID document type and number are required.");
        }
        if (!(ID_DOCUMENT_TYPES as readonly string[]).includes(idTypeInput)) {
          throw new FrontDeskError("Select a valid ID document type.");
        }
        if (idNumberInput.length > 50) {
          throw new FrontDeskError("ID document number is too long.");
        }
        idUpdate = { idDocumentType: idTypeInput, idDocumentNumber: idNumberInput };
      }

      const chosenRoomId = roomIdInput || r.roomId;
      if (!chosenRoomId) throw new FrontDeskError("Select a room to check the guest into.");

      const { assigned, options } = await getCheckInRoomState(tx, r);
      const room = options.find((option) => option.id === chosenRoomId);
      if (!room) {
        if (assigned?.room.id === chosenRoomId && assigned.problem) {
          throw new FrontDeskError(assigned.problem);
        }
        throw new FrontDeskError("That room isn't available to check into. Pick another room.");
      }

      // Guarded write: a concurrent check-in (or any status change) makes count 0.
      const updated = await tx.reservation.updateMany({
        where: { id: reservationId, status: ReservationStatus.CONFIRMED },
        data: {
          status: ReservationStatus.CHECKED_IN,
          actualCheckInAt: new Date(),
          roomId: chosenRoomId,
        },
      });
      if (updated.count === 0) {
        throw new FrontDeskError(
          "This reservation was already checked in or has changed. Refresh and try again.",
        );
      }

      if (idUpdate) await tx.guest.update({ where: { id: r.guestId }, data: idUpdate });
      await tx.room.update({ where: { id: chosenRoomId }, data: { status: RoomStatus.OCCUPIED } });

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "CHECK_IN",
          entityType: "Reservation",
          entityId: reservationId,
          metadata: {
            confirmationCode: r.confirmationCode,
            room: room.roomNumber,
            idVerified: true,
          },
        },
      });

      return {
        confirmationCode: r.confirmationCode,
        roomNumber: room.roomNumber,
        guestId: r.guestId,
      };
    });
  } catch (error) {
    if (error instanceof FrontDeskError) return { status: "error", error: error.message };
    throw error;
  }

  revalidateFrontDesk(reservationId, result.guestId);
  return {
    status: "success",
    message: `${result.confirmationCode} checked in to room ${result.roomNumber}.`,
  };
}

export async function checkOutReservationAction(reservationId: string): Promise<CheckOutResult> {
  const user = await requirePermission("checkInOut", "manage");

  let result: { message: string; guestId: string };
  try {
    result = await prisma.$transaction(async (tx) => {
      const preview = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: { roomTypeId: true },
      });
      if (!preview) throw new FrontDeskError("Reservation not found.");

      await lockRoomTypes(tx, [preview.roomTypeId]);

      const r = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { room: true },
      });
      if (!r) throw new FrontDeskError("Reservation not found.");
      if (r.status === ReservationStatus.CHECKED_OUT) {
        throw new FrontDeskError("This reservation has already been checked out.");
      }
      if (r.status !== ReservationStatus.CHECKED_IN) {
        throw new FrontDeskError("Only checked-in reservations can be checked out.");
      }

      const updated = await tx.reservation.updateMany({
        where: { id: reservationId, status: ReservationStatus.CHECKED_IN },
        data: { status: ReservationStatus.CHECKED_OUT, actualCheckOutAt: new Date() },
      });
      if (updated.count === 0) {
        throw new FrontDeskError(
          "This reservation was already checked out or has changed. Refresh and try again.",
        );
      }

      // Free the room and flag it for housekeeping. MAINTENANCE / OUT_OF_SERVICE are manual
      // and never overwritten; a room still holding another in-house guest is left alone.
      if (r.roomId && r.room) {
        const otherInHouse = await tx.reservation.count({
          where: {
            roomId: r.roomId,
            status: ReservationStatus.CHECKED_IN,
            id: { not: reservationId },
          },
        });
        if (otherInHouse === 0) {
          await tx.room.update({
            where: { id: r.roomId },
            data: {
              housekeepingStatus: HousekeepingStatus.DIRTY,
              ...(UNBOOKABLE_ROOM_STATUSES.includes(r.room.status)
                ? {}
                : { status: RoomStatus.AVAILABLE }),
            },
          });
          // Queue the cleaning: a pending CLEANING task unless one is already open.
          await ensureOpenCleaningTask(tx, r.roomId);

          await notifyRole(tx, Role.HOUSEKEEPING, {
            type: NotificationType.HOUSEKEEPING,
            title: "Room needs cleaning",
            message: `Room ${r.room.roomNumber} was marked dirty after checkout.`,
            relatedEntityType: "Room",
            relatedEntityId: r.roomId,
          });
        }
      }

      // Warning only: checkout never requires payment. Uses the shared balance calculation.
      const balanceDue = (await getPaymentSummary(tx, reservationId))?.balance ?? 0;

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "CHECK_OUT",
          entityType: "Reservation",
          entityId: reservationId,
          metadata: {
            confirmationCode: r.confirmationCode,
            room: r.room?.roomNumber ?? null,
            balanceDue,
          },
        },
      });

      return {
        guestId: r.guestId,
        message:
          `${r.confirmationCode} checked out${r.room ? ` of room ${r.room.roomNumber}` : ""}.` +
          (balanceDue > 0 ? ` Outstanding balance: ${formatCurrency(balanceDue)}.` : ""),
      };
    });
  } catch (error) {
    if (error instanceof FrontDeskError) return { status: "error", error: error.message };
    throw error;
  }

  revalidateFrontDesk(reservationId, result.guestId);
  return { status: "success", message: result.message };
}
