import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getFrontDeskBoard } from "@/lib/front-desk";
import { FrontDeskBoard } from "./front-desk-board";

export default async function CheckInCheckOutPage() {
  const user = await requirePermission("checkInOut");
  const board = await getFrontDeskBoard();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Check-in / Check-out</h1>
        <p className="text-muted-foreground">Check guests in and out and see who is in-house.</p>
      </div>
      <FrontDeskBoard
        arrivals={board.arrivals}
        pendingArrivals={board.pendingArrivals}
        inHouse={board.inHouse}
        canManage={can(user.role, "checkInOut", "manage")}
      />
    </div>
  );
}
