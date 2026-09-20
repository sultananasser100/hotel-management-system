import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getGuests } from "@/lib/guests";
import { GuestsTable } from "./guests-table";

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requirePermission("guests");
  const params = await searchParams;

  const query = firstValue(params.q).trim().slice(0, 100);
  const parsedPage = Number.parseInt(firstValue(params.page), 10);
  const requestedPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { items, total, page, totalPages } = await getGuests({ query, page: requestedPage });
  const canManage = can(user.role, "guests", "manage");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Guests</h1>
        <p className="text-muted-foreground">Manage guest profiles and view their stay history.</p>
      </div>
      <GuestsTable
        guests={items}
        total={total}
        page={page}
        totalPages={totalPages}
        query={query}
        canManage={canManage}
      />
    </div>
  );
}
