import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// Active guests only, for the reservation form's guest picker.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "reservations", "manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  const words = query.split(/\s+/).filter(Boolean).slice(0, 5);

  const guests = await prisma.guest.findMany({
    where: {
      isActive: true,
      AND: words.map((word) => ({
        OR: [
          { firstName: { contains: word, mode: "insensitive" as const } },
          { lastName: { contains: word, mode: "insensitive" as const } },
          { email: { contains: word, mode: "insensitive" as const } },
          { phone: { contains: word, mode: "insensitive" as const } },
        ],
      })),
    },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 10,
  });

  return Response.json({
    guests: guests.map((g) => ({
      id: g.id,
      name: `${g.firstName} ${g.lastName}`,
      detail: g.email ?? g.phone ?? null,
    })),
  });
}
