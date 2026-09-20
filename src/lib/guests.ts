import type { Prisma } from "@/generated/prisma/client";
import { ReservationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { todayDateOnly } from "@/lib/dashboard";
import { GUESTS_PAGE_SIZE } from "@/lib/guest-constants";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Every search word must match at least one of these fields (case-insensitive),
// so "elena pet" finds Elena Petrova.
function buildSearchWhere(query: string): Prisma.GuestWhereInput {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  return {
    AND: words.map((word) => ({
      OR: [
        { firstName: { contains: word, mode: "insensitive" as const } },
        { lastName: { contains: word, mode: "insensitive" as const } },
        { email: { contains: word, mode: "insensitive" as const } },
        { phone: { contains: word, mode: "insensitive" as const } },
      ],
    })),
  };
}

export async function getGuests({ query, page }: { query: string; page: number }) {
  const where = buildSearchWhere(query);
  const total = await prisma.guest.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / GUESTS_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const items = await prisma.guest.findMany({
    where,
    include: { _count: { select: { reservations: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    skip: (currentPage - 1) * GUESTS_PAGE_SIZE,
    take: GUESTS_PAGE_SIZE,
  });

  return { items, total, page: currentPage, totalPages };
}

export type GuestListItem = Awaited<ReturnType<typeof getGuests>>["items"][number];

export async function getGuestById(id: string) {
  const guest = await prisma.guest.findUnique({
    where: { id },
    include: {
      reservations: {
        include: {
          roomType: { select: { name: true } },
          room: { select: { roomNumber: true } },
        },
        orderBy: { checkInDate: "desc" },
      },
    },
  });
  if (!guest) return null;

  const today = todayDateOnly();
  const { reservations, ...guestFields } = guest;

  const history = reservations.map((r) => ({
    id: r.id,
    confirmationCode: r.confirmationCode,
    status: r.status,
    checkInDate: r.checkInDate,
    checkOutDate: r.checkOutDate,
    nights: Math.round((r.checkOutDate.getTime() - r.checkInDate.getTime()) / MS_PER_DAY),
    roomTypeName: r.roomType.name,
    roomNumber: r.room?.roomNumber ?? null,
    // Prisma Decimal can't cross the Server -> Client Component boundary.
    totalAmount: Number(r.totalAmount),
  }));

  const completed = history.filter((r) => r.status === ReservationStatus.CHECKED_OUT);
  const upcoming = history.filter(
    (r) =>
      (r.status === ReservationStatus.PENDING || r.status === ReservationStatus.CONFIRMED) &&
      r.checkInDate >= today,
  );
  const lastCheckOut = completed.reduce<Date | null>(
    (latest, r) => (latest === null || r.checkOutDate > latest ? r.checkOutDate : latest),
    null,
  );

  return {
    guest: guestFields,
    history,
    summary: {
      totalReservations: history.length,
      completedStays: completed.length,
      upcomingReservations: upcoming.length,
      lastCheckOut,
    },
  };
}

export type GuestDetail = NonNullable<Awaited<ReturnType<typeof getGuestById>>>["guest"];
export type GuestHistoryItem = NonNullable<
  Awaited<ReturnType<typeof getGuestById>>
>["history"][number];
