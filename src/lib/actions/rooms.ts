"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { RoomStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export type RoomFormState =
  { status: "idle" } | { status: "error"; error: string } | { status: "success" };

const ROOM_STATUS_VALUES = new Set<string>(Object.values(RoomStatus));

type ParsedRoomInput = {
  roomNumber: string;
  floor: number;
  roomTypeId: string;
  status: RoomStatus;
};

function parseRoomInput(formData: FormData): ParsedRoomInput | { status: "error"; error: string } {
  const roomNumber = String(formData.get("roomNumber") ?? "").trim();
  const floorRaw = String(formData.get("floor") ?? "").trim();
  const roomTypeId = String(formData.get("roomTypeId") ?? "").trim();
  const roomStatus = String(formData.get("status") ?? "").trim();

  if (!roomNumber) {
    return { status: "error", error: "Room number is required." };
  }

  const floor = Number(floorRaw);
  if (!Number.isInteger(floor)) {
    return { status: "error", error: "Floor must be a whole number." };
  }

  if (!roomTypeId) {
    return { status: "error", error: "Room type is required." };
  }

  if (!ROOM_STATUS_VALUES.has(roomStatus)) {
    return { status: "error", error: "Invalid room status." };
  }

  return { roomNumber, floor, roomTypeId, status: roomStatus as RoomStatus };
}

function duplicateRoomNumberError(error: unknown): boolean {
  // With the pg driver adapter, `meta.target` isn't populated; the violated
  // constraint (`Room_roomNumber_key`) only appears in the error message.
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    error.message.includes("roomNumber")
  );
}

export async function createRoomAction(
  _prevState: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  await requirePermission("rooms", "manage");

  const parsed = parseRoomInput(formData);
  if ("error" in parsed) return parsed;

  try {
    await prisma.room.create({ data: parsed });
  } catch (error) {
    if (duplicateRoomNumberError(error)) {
      return { status: "error", error: `Room number ${parsed.roomNumber} already exists.` };
    }
    throw error;
  }

  revalidatePath("/rooms");
  return { status: "success" };
}

export async function updateRoomAction(
  _prevState: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  await requirePermission("rooms", "manage");

  const id = String(formData.get("id") ?? "");
  if (!id) return { status: "error", error: "Missing room id." };

  const parsed = parseRoomInput(formData);
  if ("error" in parsed) return parsed;

  try {
    await prisma.room.update({ where: { id }, data: parsed });
  } catch (error) {
    if (duplicateRoomNumberError(error)) {
      return { status: "error", error: `Room number ${parsed.roomNumber} already exists.` };
    }
    throw error;
  }

  revalidatePath("/rooms");
  return { status: "success" };
}

export type RoomActionResult = { error: string } | undefined;

export async function deleteRoomAction(id: string): Promise<RoomActionResult> {
  await requirePermission("rooms", "manage");
  await prisma.room.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/rooms");
  return undefined;
}

export async function restoreRoomAction(id: string): Promise<RoomActionResult> {
  await requirePermission("rooms", "manage");
  await prisma.room.update({ where: { id }, data: { isActive: true } });
  revalidatePath("/rooms");
  return undefined;
}
