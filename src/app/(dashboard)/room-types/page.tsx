import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getRoomTypes } from "@/lib/room-types";
import { RoomTypesTable } from "./room-types-table";

export default async function RoomTypesPage() {
  const user = await requirePermission("roomTypes");
  const roomTypes = await getRoomTypes();
  const canManage = can(user.role, "roomTypes", "manage");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Room Types</h1>
        <p className="text-muted-foreground">Manage the room types offered at the hotel.</p>
      </div>
      <RoomTypesTable roomTypes={roomTypes} canManage={canManage} />
    </div>
  );
}
