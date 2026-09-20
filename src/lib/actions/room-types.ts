"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export type RoomTypeFormState =
  { status: "idle" } | { status: "error"; error: string } | { status: "success" };

function parseAmenities(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type ParsedRoomTypeInput = {
  name: string;
  description: string | null;
  basePrice: number;
  maxOccupancy: number;
  amenities: string[];
};

function parseRoomTypeInput(
  formData: FormData,
): ParsedRoomTypeInput | { status: "error"; error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const basePriceRaw = String(formData.get("basePrice") ?? "").trim();
  const maxOccupancyRaw = String(formData.get("maxOccupancy") ?? "").trim();
  const amenitiesRaw = String(formData.get("amenities") ?? "");

  if (!name) {
    return { status: "error", error: "Name is required." };
  }

  const basePrice = Number(basePriceRaw);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return { status: "error", error: "Base price must be a positive number." };
  }

  const maxOccupancy = Number(maxOccupancyRaw);
  if (!Number.isInteger(maxOccupancy) || maxOccupancy <= 0) {
    return { status: "error", error: "Max occupancy must be a positive whole number." };
  }

  return {
    name,
    description: description || null,
    basePrice,
    maxOccupancy,
    amenities: parseAmenities(amenitiesRaw),
  };
}

export async function createRoomTypeAction(
  _prevState: RoomTypeFormState,
  formData: FormData,
): Promise<RoomTypeFormState> {
  await requirePermission("roomTypes", "manage");

  const parsed = parseRoomTypeInput(formData);
  if ("error" in parsed) return parsed;

  await prisma.roomType.create({ data: parsed });

  revalidatePath("/room-types");
  revalidatePath("/rooms");
  return { status: "success" };
}

export async function updateRoomTypeAction(
  _prevState: RoomTypeFormState,
  formData: FormData,
): Promise<RoomTypeFormState> {
  await requirePermission("roomTypes", "manage");

  const id = String(formData.get("id") ?? "");
  if (!id) return { status: "error", error: "Missing room type id." };

  const parsed = parseRoomTypeInput(formData);
  if ("error" in parsed) return parsed;

  await prisma.roomType.update({ where: { id }, data: parsed });

  revalidatePath("/room-types");
  revalidatePath("/rooms");
  return { status: "success" };
}

export type DeleteRoomTypeResult = { error: string } | undefined;

export async function deleteRoomTypeAction(id: string): Promise<DeleteRoomTypeResult> {
  await requirePermission("roomTypes", "manage");

  const roomCount = await prisma.room.count({ where: { roomTypeId: id } });
  if (roomCount > 0) {
    return {
      error: `Cannot delete: ${roomCount} room${roomCount === 1 ? "" : "s"} still use this room type.`,
    };
  }

  try {
    await prisma.roomType.delete({ where: { id } });
  } catch (error) {
    // Safety net for cases the room count pre-check doesn't cover (e.g. a
    // reservation still referencing this room type) — never expose the raw
    // Prisma/Postgres error to the user.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { error: "Cannot delete: this room type is still referenced by other records." };
    }
    throw error;
  }

  revalidatePath("/room-types");
  revalidatePath("/rooms");
}
