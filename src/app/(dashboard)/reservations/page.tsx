import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { ReservationStatus } from "@/generated/prisma/enums";
import { getReservations } from "@/lib/reservations";
import { parseDateOnly } from "@/lib/reservation-utils";
import { ReservationsTable } from "./reservations-table";

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requirePermission("reservations");
  const params = await searchParams;

  const query = firstValue(params.q).trim().slice(0, 100);
  const statusRaw = firstValue(params.status);
  const status = (Object.values(ReservationStatus) as string[]).includes(statusRaw)
    ? (statusRaw as ReservationStatus)
    : "";
  const fromRaw = firstValue(params.from);
  const toRaw = firstValue(params.to);
  const from = parseDateOnly(fromRaw);
  const to = parseDateOnly(toRaw);
  const parsedPage = Number.parseInt(firstValue(params.page), 10);
  const requestedPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { items, total, page, totalPages } = await getReservations({
    query,
    status,
    from,
    to,
    page: requestedPage,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reservations</h1>
        <p className="text-muted-foreground">Search, create, and manage guest reservations.</p>
      </div>
      <ReservationsTable
        reservations={items}
        total={total}
        page={page}
        totalPages={totalPages}
        filters={{
          q: query,
          status,
          from: from ? fromRaw : "",
          to: to ? toRaw : "",
        }}
        canManage={can(user.role, "reservations", "manage")}
        canFrontDesk={can(user.role, "checkInOut", "manage")}
        canViewGuests={can(user.role, "guests", "view")}
      />
    </div>
  );
}
