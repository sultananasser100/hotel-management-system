"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";

export type NotificationActionResult = { status: "error"; error: string } | { status: "success" };

function revalidateNotifications() {
  revalidatePath("/notifications");
  // The bell lives in the shared dashboard layout, rendered on every route in the group.
  revalidatePath("/dashboard", "layout");
}

export async function markNotificationReadAction(id: string): Promise<NotificationActionResult> {
  const user = await requireUser();
  if (!id) return { status: "error", error: "Missing notification id." };

  await markNotificationRead({ id: user.id, role: user.role }, id);
  revalidateNotifications();
  return { status: "success" };
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  const user = await requireUser();

  await markAllNotificationsRead({ id: user.id, role: user.role });
  revalidateNotifications();
  return { status: "success" };
}
