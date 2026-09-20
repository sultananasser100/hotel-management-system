"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { ReservationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ID_DOCUMENT_TYPES } from "@/lib/guest-constants";
import { COUNTRY_SET } from "@/lib/countries";

export type GuestFormState =
  { status: "idle" } | { status: "error"; error: string } | { status: "success" };

type ParsedGuestInput = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  idDocumentType: string | null;
  idDocumentNumber: string | null;
  nationality: string | null;
  address: string | null;
  notes: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-().\s]{7,20}$/;

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

// `existingNationality` lets an edit keep a legacy free-text value that isn't in the list.
function parseGuestInput(
  formData: FormData,
  existingNationality: string | null = null,
): ParsedGuestInput | { status: "error"; error: string } {
  const firstName = field(formData, "firstName");
  const lastName = field(formData, "lastName");
  const email = field(formData, "email").toLowerCase();
  const phone = field(formData, "phone");
  const idDocumentTypeRaw = field(formData, "idDocumentType");
  const idDocumentType = idDocumentTypeRaw === "none" ? "" : idDocumentTypeRaw;
  const idDocumentNumber = field(formData, "idDocumentNumber");
  const nationality = field(formData, "nationality");
  const address = field(formData, "address");
  const notes = field(formData, "notes");

  const fail = (error: string) => ({ status: "error" as const, error });

  if (!firstName) return fail("First name is required.");
  if (!lastName) return fail("Last name is required.");
  if (firstName.length > 100 || lastName.length > 100) {
    return fail("Names must be 100 characters or fewer.");
  }
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
    return fail("Enter a valid email address.");
  }
  if (phone && !PHONE_PATTERN.test(phone)) {
    return fail("Phone must be 7–20 characters: digits, spaces, and + - ( ) . only.");
  }
  if (idDocumentType && !(ID_DOCUMENT_TYPES as readonly string[]).includes(idDocumentType)) {
    return fail("Invalid ID document type.");
  }
  if (Boolean(idDocumentType) !== Boolean(idDocumentNumber)) {
    return fail("Provide both the ID document type and number, or neither.");
  }
  if (idDocumentNumber.length > 50) return fail("ID document number is too long.");
  if (nationality && !COUNTRY_SET.has(nationality) && nationality !== existingNationality) {
    return fail("Select a nationality from the list.");
  }
  if (address.length > 300) return fail("Address must be 300 characters or fewer.");
  if (notes.length > 1000) return fail("Notes must be 1000 characters or fewer.");

  return {
    firstName,
    lastName,
    email: email || null,
    phone: phone || null,
    idDocumentType: idDocumentType || null,
    idDocumentNumber: idDocumentNumber || null,
    nationality: nationality || null,
    address: address || null,
    notes: notes || null,
  };
}

export async function createGuestAction(
  _prevState: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  await requirePermission("guests", "manage");

  const parsed = parseGuestInput(formData);
  if ("error" in parsed) return parsed;

  await prisma.guest.create({ data: parsed });

  revalidatePath("/guests");
  return { status: "success" };
}

export async function updateGuestAction(
  _prevState: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  await requirePermission("guests", "manage");

  const id = field(formData, "id");
  if (!id) return { status: "error", error: "Missing guest id." };

  const existing = await prisma.guest.findUnique({ where: { id }, select: { nationality: true } });
  const parsed = parseGuestInput(formData, existing?.nationality ?? null);
  if ("error" in parsed) return parsed;

  try {
    await prisma.guest.update({ where: { id }, data: parsed });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { status: "error", error: "This guest no longer exists." };
    }
    throw error;
  }

  revalidatePath("/guests");
  revalidatePath(`/guests/${id}`);
  return { status: "success" };
}

export type GuestActionResult = { error: string } | undefined;

// Guests are never hard-deleted: reservations reference them (ON DELETE RESTRICT)
// and stay history should be kept. "Delete" deactivates the guest instead.
export async function deactivateGuestAction(id: string): Promise<GuestActionResult> {
  await requirePermission("guests", "manage");

  const openReservations = await prisma.reservation.count({
    where: {
      guestId: id,
      status: {
        in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
      },
    },
  });
  if (openReservations > 0) {
    return {
      error: `Cannot delete: this guest has ${openReservations} pending, confirmed, or checked-in reservation${openReservations === 1 ? "" : "s"}.`,
    };
  }

  await prisma.guest.update({ where: { id }, data: { isActive: false } });

  revalidatePath("/guests");
  revalidatePath(`/guests/${id}`);
  return undefined;
}

export async function restoreGuestAction(id: string): Promise<GuestActionResult> {
  await requirePermission("guests", "manage");
  await prisma.guest.update({ where: { id }, data: { isActive: true } });

  revalidatePath("/guests");
  revalidatePath(`/guests/${id}`);
  return undefined;
}
