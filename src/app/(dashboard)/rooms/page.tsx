import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getRoomTypeOptions, getRooms } from "@/lib/rooms";
import { RoomsTable } from "./rooms-table";

export default async function RoomsPage() {
  const user = await requirePermission("rooms");
  const [rooms, roomTypes] = await Promise.all([getRooms(), getRoomTypeOptions()]);
  const canManage = can(user.role, "rooms", "manage");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rooms</h1>
        <p className="text-muted-foreground">Manage the hotel&apos;s rooms and their status.</p>
      </div>
      <RoomsTable rooms={rooms} roomTypes={roomTypes} canManage={canManage} />
    </div>
  );
}
