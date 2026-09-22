import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getRoomHousekeepingHistory } from "@/lib/housekeeping";

// Read-only history for one room, loaded when the history dialog opens.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "housekeeping", "view")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const history = await getRoomHousekeepingHistory(id);
  if (!history) {
    return Response.json({ error: "Room not found." }, { status: 404 });
  }
  return Response.json(history);
}
