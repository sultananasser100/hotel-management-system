import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getFrontDeskInfo } from "@/lib/front-desk";

// Read-only data for the check-in / check-out dialogs. (Server Actions are dispatched
// one at a time, so reads go through a route handler instead.)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user.role, "checkInOut", "manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const info = await getFrontDeskInfo(id, {
    canRecordPayment: can(session.user.role, "payments", "manage"),
  });
  if (!info) {
    return Response.json({ error: "Reservation not found." }, { status: 404 });
  }
  return Response.json(info);
}
