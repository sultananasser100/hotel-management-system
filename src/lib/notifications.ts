import type { Prisma } from "@/generated/prisma/client";
import { NotificationType, Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient;

export type NotificationRecipient = { id: string; role: Role };

type NotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

// Called from inside an existing feature's transaction, right after its
// ActivityLog.create — same placement, same atomicity, same guarantee that a
// rolled-back transaction never leaves a stray notification behind.
export async function notifyRole(tx: Db, role: Role, input: NotificationInput) {
  await tx.notification.create({ data: { role, ...input } });
}

export async function notifyUser(tx: Db, userId: string, input: NotificationInput) {
  await tx.notification.create({ data: { userId, ...input } });
}

function recipientWhere(user: NotificationRecipient): Prisma.NotificationWhereInput {
  return { OR: [{ userId: user.id }, { role: user.role }] };
}

export const NOTIFICATIONS_PAGE_SIZE = 20;
export const NOTIFICATION_BELL_LIMIT = 10;

export async function getRecentNotifications(
  user: NotificationRecipient,
  limit = NOTIFICATION_BELL_LIMIT,
) {
  return prisma.notification.findMany({
    where: recipientWhere(user),
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export type NotificationListItem = Awaited<ReturnType<typeof getRecentNotifications>>[number];

export async function getUnreadNotificationCount(user: NotificationRecipient) {
  return prisma.notification.count({ where: { ...recipientWhere(user), isRead: false } });
}

export type NotificationFilter = "all" | "unread";

export async function getNotificationsPage(
  user: NotificationRecipient,
  { page: requestedPage, filter }: { page: number; filter: NotificationFilter },
) {
  const where: Prisma.NotificationWhereInput = {
    ...recipientWhere(user),
    ...(filter === "unread" ? { isRead: false } : {}),
  };

  const total = await prisma.notification.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / NOTIFICATIONS_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);

  const items = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * NOTIFICATIONS_PAGE_SIZE,
    take: NOTIFICATIONS_PAGE_SIZE,
  });

  return { items, total, page, totalPages };
}

// Ownership is always enforced here, in the where clause — never trust a
// client-supplied recipient beyond "give me the id you want marked read."
export async function markNotificationRead(user: NotificationRecipient, id: string) {
  await prisma.notification.updateMany({
    where: { id, ...recipientWhere(user) },
    data: { isRead: true },
  });
}

export async function markAllNotificationsRead(user: NotificationRecipient) {
  await prisma.notification.updateMany({
    where: { ...recipientWhere(user), isRead: false },
    data: { isRead: true },
  });
}
