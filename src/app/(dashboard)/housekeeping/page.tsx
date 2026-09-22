import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { HousekeepingStatus, Role } from "@/generated/prisma/enums";
import {
  getFloors,
  getHousekeepers,
  getHousekeepingBoard,
  getHousekeepingSummary,
} from "@/lib/housekeeping";
import { HousekeepingSummary } from "./housekeeping-summary";
import { HousekeepingTable } from "./housekeeping-table";

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function HousekeepingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requirePermission("housekeeping");
  const params = await searchParams;

  const housekeepers = await getHousekeepers();

  const query = firstValue(params.q).trim().slice(0, 20);
  const statusRaw = firstValue(params.status);
  const status =
    statusRaw === "attention" || (Object.values(HousekeepingStatus) as string[]).includes(statusRaw)
      ? (statusRaw as HousekeepingStatus | "attention")
      : "";
  const floorRaw = Number.parseInt(firstValue(params.floor), 10);
  const floor = Number.isInteger(floorRaw) ? floorRaw : null;
  const assigneeRaw = firstValue(params.assignee);
  const assignee =
    assigneeRaw === "me" ||
    assigneeRaw === "none" ||
    housekeepers.some((housekeeper) => housekeeper.id === assigneeRaw)
      ? assigneeRaw
      : "";
  const parsedPage = Number.parseInt(firstValue(params.page), 10);
  const requestedPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [board, summary, floors] = await Promise.all([
    getHousekeepingBoard({ query, status, floor, assignee, page: requestedPage }, user.id),
    getHousekeepingSummary(),
    getFloors(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Housekeeping</h1>
        <p className="text-muted-foreground">
          Track room cleanliness, assign cleaning, and see what needs attention.
        </p>
      </div>

      <HousekeepingSummary counts={summary} />

      <HousekeepingTable
        rooms={board.items}
        total={board.total}
        page={board.page}
        totalPages={board.totalPages}
        filters={{
          q: query,
          status,
          floor: floor === null ? "" : String(floor),
          assignee,
        }}
        floors={floors}
        housekeepers={housekeepers}
        canManage={can(user.role, "housekeeping", "manage")}
        isAdmin={user.role === Role.ADMIN}
        currentUserId={user.id}
      />
    </div>
  );
}
