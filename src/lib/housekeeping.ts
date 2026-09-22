import type { Prisma } from "@/generated/prisma/client";
import {
  HousekeepingStatus,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
  ReservationStatus,
  Role,
  type HousekeepingTaskPriority,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { todayDateOnly } from "@/lib/dashboard";
import { formatTimestamp } from "@/lib/format";
import {
  HOUSEKEEPING_LOG_ACTIONS,
  HOUSEKEEPING_LOG_LABEL,
  HOUSEKEEPING_PAGE_SIZE,
  HOUSEKEEPING_STATE_LABEL,
  OPEN_TASK_STATUSES,
  PRIORITY_LABEL,
} from "@/lib/housekeeping-rules";

type Db = Prisma.TransactionClient;

const OPEN_CLEANING = {
  type: HousekeepingTaskType.CLEANING,
  status: { in: OPEN_TASK_STATUSES },
};

// Used by checkout (inside its transaction): make sure the room has a pending cleaning task.
export async function ensureOpenCleaningTask(db: Db, roomId: string) {
  const open = await db.housekeepingTask.findFirst({
    where: { roomId, ...OPEN_CLEANING },
    select: { id: true },
  });
  if (open) return;

  await db.housekeepingTask.create({
    data: {
      roomId,
      type: HousekeepingTaskType.CLEANING,
      status: HousekeepingTaskStatus.PENDING,
    },
  });
}

export type HousekeepingFilters = {
  query: string;
  // "attention" = DIRTY + IN_PROGRESS.
  status: HousekeepingStatus | "attention" | "";
  floor: number | null;
  // "" = anyone, "me", "none" (unassigned), or a housekeeper's user id.
  assignee: string;
  page: number;
};

function buildWhere(filters: HousekeepingFilters, currentUserId: string): Prisma.RoomWhereInput {
  const and: Prisma.RoomWhereInput[] = [];

  if (filters.query) {
    and.push({ roomNumber: { contains: filters.query, mode: "insensitive" } });
  }
  if (filters.floor !== null) and.push({ floor: filters.floor });

  if (filters.status === "attention") {
    and.push({
      housekeepingStatus: { in: [HousekeepingStatus.DIRTY, HousekeepingStatus.IN_PROGRESS] },
    });
  } else if (filters.status) {
    and.push({ housekeepingStatus: filters.status });
  }

  if (filters.assignee === "none") {
    and.push({
      housekeepingTasks: { none: { ...OPEN_CLEANING, assignedToId: { not: null } } },
    });
  } else if (filters.assignee) {
    const assigneeId = filters.assignee === "me" ? currentUserId : filters.assignee;
    and.push({ housekeepingTasks: { some: { ...OPEN_CLEANING, assignedToId: assigneeId } } });
  }

  return { isActive: true, AND: and };
}

export async function getHousekeepingBoard(filters: HousekeepingFilters, currentUserId: string) {
  const where = buildWhere(filters, currentUserId);
  const total = await prisma.room.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / HOUSEKEEPING_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), totalPages);

  const rooms = await prisma.room.findMany({
    where,
    include: {
      roomType: { select: { name: true } },
      housekeepingTasks: {
        where: OPEN_CLEANING,
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { assignedTo: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
    skip: (page - 1) * HOUSEKEEPING_PAGE_SIZE,
    take: HOUSEKEEPING_PAGE_SIZE,
  });

  // Guest context for the rooms on this page, from existing reservation data.
  const today = todayDateOnly();
  const roomIds = rooms.map((room) => room.id);
  const reservations =
    roomIds.length === 0
      ? []
      : await prisma.reservation.findMany({
          where: {
            roomId: { in: roomIds },
            OR: [
              { status: ReservationStatus.CHECKED_IN },
              { status: ReservationStatus.CONFIRMED, checkInDate: today },
            ],
          },
          select: { roomId: true, status: true, checkOutDate: true },
        });

  const items = rooms.map((room) => {
    const task = room.housekeepingTasks[0] ?? null;
    const roomReservations = reservations.filter((r) => r.roomId === room.id);
    const inHouse = roomReservations.filter((r) => r.status === ReservationStatus.CHECKED_IN);

    return {
      id: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomTypeName: room.roomType.name,
      housekeepingStatus: room.housekeepingStatus,
      roomStatus: room.status,
      task: task
        ? {
            id: task.id,
            status: task.status,
            priority: task.priority,
            notes: task.notes,
            assigneeId: task.assignedTo?.id ?? null,
            assigneeName: task.assignedTo?.name ?? null,
          }
        : null,
      inHouse: inHouse.length > 0,
      departsToday: inHouse.some((r) => r.checkOutDate.getTime() === today.getTime()),
      arrivingToday: roomReservations.some((r) => r.status === ReservationStatus.CONFIRMED),
      updatedLabel: formatTimestamp(task?.updatedAt ?? room.updatedAt),
    };
  });

  return { items, total, page, totalPages };
}

export type HousekeepingRow = Awaited<ReturnType<typeof getHousekeepingBoard>>["items"][number];

export async function getHousekeepingSummary() {
  const rows = await prisma.room.groupBy({
    by: ["housekeepingStatus"],
    where: { isActive: true },
    _count: { _all: true },
  });
  const counts = new Map(rows.map((row) => [row.housekeepingStatus, row._count._all]));

  const order = [
    HousekeepingStatus.DIRTY,
    HousekeepingStatus.IN_PROGRESS,
    HousekeepingStatus.CLEAN,
    HousekeepingStatus.INSPECTED,
  ];
  return order.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

export async function getHousekeepers() {
  return prisma.user.findMany({
    where: { role: Role.HOUSEKEEPING, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type Housekeeper = Awaited<ReturnType<typeof getHousekeepers>>[number];

export async function getFloors(): Promise<number[]> {
  const rows = await prisma.room.findMany({
    where: { isActive: true },
    select: { floor: true },
    distinct: ["floor"],
    orderBy: { floor: "asc" },
  });
  return rows.map((row) => row.floor);
}

function describeEvent(action: string, metadata: unknown): string {
  const data = (metadata ?? {}) as Record<string, unknown>;
  const label = (value: unknown) =>
    typeof value === "string" && value in HOUSEKEEPING_STATE_LABEL
      ? HOUSEKEEPING_STATE_LABEL[value as HousekeepingStatus]
      : null;

  if (action === "ASSIGN_HOUSEKEEPER") {
    const assignee = typeof data.assignee === "string" ? data.assignee : null;
    const priority =
      typeof data.priority === "string" && data.priority in PRIORITY_LABEL
        ? PRIORITY_LABEL[data.priority as HousekeepingTaskPriority]
        : null;
    return `${assignee ? `Assigned to ${assignee}` : "Unassigned"}${priority ? ` · ${priority} priority` : ""}`;
  }

  const from = label(data.from);
  const to = label(data.to);
  const assignee = typeof data.assignee === "string" ? ` · ${data.assignee}` : "";
  return from && to ? `${from} → ${to}${assignee}` : "";
}

// Existing data only: the room's cleaning tasks plus its housekeeping entries in the activity log.
export async function getRoomHousekeepingHistory(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { roomNumber: true },
  });
  if (!room) return null;

  const [tasks, events] = await Promise.all([
    prisma.housekeepingTask.findMany({
      where: { roomId, type: HousekeepingTaskType.CLEANING },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { assignedTo: { select: { name: true } } },
    }),
    prisma.activityLog.findMany({
      where: {
        entityType: "Room",
        entityId: roomId,
        action: { in: HOUSEKEEPING_LOG_ACTIONS },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return {
    roomNumber: room.roomNumber,
    tasks: tasks.map((task) => ({
      id: task.id,
      status: task.status,
      priority: task.priority,
      notes: task.notes,
      assigneeName: task.assignedTo?.name ?? null,
      createdLabel: formatTimestamp(task.createdAt),
      completedLabel: task.completedAt ? formatTimestamp(task.completedAt) : null,
    })),
    events: events.map((event) => ({
      id: event.id,
      title: HOUSEKEEPING_LOG_LABEL[event.action] ?? event.action,
      detail: describeEvent(event.action, event.metadata),
      actor: event.user?.name ?? "System",
      timeLabel: formatTimestamp(event.createdAt),
    })),
  };
}

export type RoomHousekeepingHistory = NonNullable<
  Awaited<ReturnType<typeof getRoomHousekeepingHistory>>
>;
