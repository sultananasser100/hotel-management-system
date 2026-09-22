"use server";

import { revalidatePath } from "next/cache";
import {
  HousekeepingStatus,
  HousekeepingTaskPriority,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
  NotificationType,
  Role,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import {
  MAX_TASK_NOTES_LENGTH,
  OPEN_TASK_STATUSES,
  TASK_STATUS_FOR_ROOM_STATUS,
  findTransition,
} from "@/lib/housekeeping-rules";
import { lockRoom } from "@/lib/room-lock";
import { notifyUser } from "@/lib/notifications";

export type HousekeepingActionResult =
  { status: "error"; error: string } | { status: "success"; message: string };

export type AssignFormState =
  { status: "idle" } | { status: "error"; error: string } | { status: "success"; message: string };

class HousekeepingError extends Error {}

const STATUS_VALUES = new Set<string>(Object.values(HousekeepingStatus));
const PRIORITY_VALUES = new Set<string>(Object.values(HousekeepingTaskPriority));

const STALE_MESSAGE = "This room was updated by someone else. Refresh the page and try again.";

const OPEN_CLEANING = {
  type: HousekeepingTaskType.CLEANING,
  status: { in: OPEN_TASK_STATUSES },
};

function revalidateHousekeeping() {
  revalidatePath("/housekeeping");
  revalidatePath("/dashboard");
}

export async function changeHousekeepingStatusAction(
  roomId: string,
  expectedStatus: string,
  nextStatus: string,
  takeOver = false,
): Promise<HousekeepingActionResult> {
  const user = await requirePermission("housekeeping", "manage");

  if (!STATUS_VALUES.has(expectedStatus) || !STATUS_VALUES.has(nextStatus)) {
    return { status: "error", error: "Invalid housekeeping status." };
  }
  const from = expectedStatus as HousekeepingStatus;
  const to = nextStatus as HousekeepingStatus;

  const transition = findTransition(from, to);
  if (!transition) {
    return { status: "error", error: "That status change isn't allowed." };
  }
  if (transition.adminOnly && user.role !== Role.ADMIN) {
    return { status: "error", error: "Only an administrator can do this." };
  }

  const actorName = user.name ?? "Unknown";

  try {
    const message = await prisma.$transaction(async (tx) => {
      await lockRoom(tx, roomId);

      // Re-read under the lock: the UI's view may be stale.
      const room = await tx.room.findUnique({
        where: { id: roomId },
        select: { roomNumber: true, isActive: true, housekeepingStatus: true },
      });
      if (!room) throw new HousekeepingError("Room not found.");
      if (!room.isActive) throw new HousekeepingError("This room is inactive.");
      if (room.housekeepingStatus !== from) throw new HousekeepingError(STALE_MESSAGE);

      const openTask = await tx.housekeepingTask.findFirst({
        where: { roomId, ...OPEN_CLEANING },
        orderBy: { createdAt: "desc" },
        include: { assignedTo: { select: { name: true } } },
      });

      // Every write to a task is guarded on the status we just read.
      const updateOpenTask = async (data: {
        status: HousekeepingTaskStatus;
        assignedToId?: string;
        completedAt?: Date;
      }) => {
        if (!openTask) return;
        const updated = await tx.housekeepingTask.updateMany({
          where: { id: openTask.id, status: openTask.status },
          data,
        });
        if (updated.count === 0) throw new HousekeepingError(STALE_MESSAGE);
      };

      let assigneeName: string | null = openTask?.assignedTo?.name ?? null;

      if (to === HousekeepingStatus.IN_PROGRESS) {
        // Whoever starts the cleaning becomes the assignee; taking over needs confirmation.
        if (openTask?.assignedToId && openTask.assignedToId !== user.id && !takeOver) {
          throw new HousekeepingError(
            `This cleaning is assigned to ${openTask.assignedTo?.name ?? "another housekeeper"}. Confirm to take it over.`,
          );
        }
        if (openTask) {
          await updateOpenTask({
            status: TASK_STATUS_FOR_ROOM_STATUS[to],
            assignedToId: user.id,
          });
        } else {
          await tx.housekeepingTask.create({
            data: {
              roomId,
              type: HousekeepingTaskType.CLEANING,
              status: TASK_STATUS_FOR_ROOM_STATUS[to],
              assignedToId: user.id,
            },
          });
        }
        assigneeName = actorName;
      } else if (to === HousekeepingStatus.CLEAN) {
        const now = new Date();
        if (openTask) {
          await updateOpenTask({ status: TASK_STATUS_FOR_ROOM_STATUS[to], completedAt: now });
        } else {
          // Legacy room with no task: record the completed cleaning anyway.
          await tx.housekeepingTask.create({
            data: {
              roomId,
              type: HousekeepingTaskType.CLEANING,
              status: TASK_STATUS_FOR_ROOM_STATUS[to],
              assignedToId: user.id,
              completedAt: now,
            },
          });
          assigneeName = actorName;
        }
      } else if (to === HousekeepingStatus.INSPECTED) {
        // Verify the most recent completed cleaning, if there is one.
        const completed = await tx.housekeepingTask.findFirst({
          where: {
            roomId,
            type: HousekeepingTaskType.CLEANING,
            status: HousekeepingTaskStatus.COMPLETED,
          },
          orderBy: { updatedAt: "desc" },
        });
        if (completed) {
          const updated = await tx.housekeepingTask.updateMany({
            where: { id: completed.id, status: HousekeepingTaskStatus.COMPLETED },
            data: { status: TASK_STATUS_FOR_ROOM_STATUS[to] },
          });
          if (updated.count === 0) throw new HousekeepingError(STALE_MESSAGE);
        }
      } else if (to === HousekeepingStatus.DIRTY) {
        // Use the open task if one exists (put back to pending), otherwise queue a new one.
        if (openTask) {
          await updateOpenTask({ status: TASK_STATUS_FOR_ROOM_STATUS[to] });
        } else {
          await tx.housekeepingTask.create({
            data: {
              roomId,
              type: HousekeepingTaskType.CLEANING,
              status: TASK_STATUS_FOR_ROOM_STATUS[to],
            },
          });
        }
      }

      await tx.room.update({ where: { id: roomId }, data: { housekeepingStatus: to } });

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: transition.logAction,
          entityType: "Room",
          entityId: roomId,
          metadata: { room: room.roomNumber, from, to, assignee: assigneeName },
        },
      });

      return {
        [HousekeepingStatus.IN_PROGRESS]: `Room ${room.roomNumber}: cleaning started.`,
        [HousekeepingStatus.CLEAN]: `Room ${room.roomNumber} marked clean.`,
        [HousekeepingStatus.INSPECTED]: `Room ${room.roomNumber} inspected.`,
        [HousekeepingStatus.DIRTY]: `Room ${room.roomNumber} marked dirty and queued for cleaning.`,
      }[to];
    });

    revalidateHousekeeping();
    return { status: "success", message };
  } catch (error) {
    if (error instanceof HousekeepingError) return { status: "error", error: error.message };
    throw error;
  }
}

export async function assignHousekeeperAction(
  _prevState: AssignFormState,
  formData: FormData,
): Promise<AssignFormState> {
  const user = await requirePermission("housekeeping", "manage");
  if (user.role !== Role.ADMIN) {
    return { status: "error", error: "Only an administrator can assign housekeepers." };
  }

  const field = (name: string) => String(formData.get(name) ?? "").trim();

  const roomId = field("roomId");
  if (!roomId) return { status: "error", error: "Missing room id." };

  const expectedStatus = field("expectedStatus");
  if (!STATUS_VALUES.has(expectedStatus)) {
    return { status: "error", error: "Invalid housekeeping status." };
  }

  const assigneeInput = field("assignee");
  const assigneeId = !assigneeInput || assigneeInput === "none" ? null : assigneeInput;

  const priority = field("priority");
  if (!PRIORITY_VALUES.has(priority)) return { status: "error", error: "Select a priority." };

  const notes = field("notes");
  if (notes.length > MAX_TASK_NOTES_LENGTH) {
    return {
      status: "error",
      error: `Notes must be ${MAX_TASK_NOTES_LENGTH} characters or fewer.`,
    };
  }

  try {
    const message = await prisma.$transaction(async (tx) => {
      await lockRoom(tx, roomId);

      const room = await tx.room.findUnique({
        where: { id: roomId },
        select: { roomNumber: true, isActive: true, housekeepingStatus: true },
      });
      if (!room) throw new HousekeepingError("Room not found.");
      if (!room.isActive) throw new HousekeepingError("This room is inactive.");
      if (room.housekeepingStatus !== expectedStatus) throw new HousekeepingError(STALE_MESSAGE);

      // Only rooms with cleaning to do can be assigned.
      if (
        room.housekeepingStatus !== HousekeepingStatus.DIRTY &&
        room.housekeepingStatus !== HousekeepingStatus.IN_PROGRESS
      ) {
        throw new HousekeepingError("This room is already clean, so there is nothing to assign.");
      }

      let assigneeName: string | null = null;
      if (assigneeId) {
        const assignee = await tx.user.findFirst({
          where: { id: assigneeId, role: Role.HOUSEKEEPING, isActive: true },
          select: { name: true },
        });
        if (!assignee) throw new HousekeepingError("Select an active housekeeper.");
        assigneeName = assignee.name;
      }

      const openTask = await tx.housekeepingTask.findFirst({
        where: { roomId, ...OPEN_CLEANING },
        orderBy: { createdAt: "desc" },
      });

      const data = {
        assignedToId: assigneeId,
        priority: priority as HousekeepingTaskPriority,
        notes: notes || null,
      };

      if (openTask) {
        const updated = await tx.housekeepingTask.updateMany({
          where: { id: openTask.id, status: openTask.status },
          data,
        });
        if (updated.count === 0) throw new HousekeepingError(STALE_MESSAGE);
      } else {
        await tx.housekeepingTask.create({
          data: {
            roomId,
            type: HousekeepingTaskType.CLEANING,
            status: TASK_STATUS_FOR_ROOM_STATUS[room.housekeepingStatus],
            ...data,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "ASSIGN_HOUSEKEEPER",
          entityType: "Room",
          entityId: roomId,
          metadata: { room: room.roomNumber, assignee: assigneeName, priority },
        },
      });

      if (assigneeId) {
        const urgent = priority === HousekeepingTaskPriority.URGENT;
        await notifyUser(tx, assigneeId, {
          type: NotificationType.HOUSEKEEPING,
          title: "Cleaning task assigned to you",
          message: `You were assigned to clean room ${room.roomNumber}${urgent ? " (urgent)" : ""}.`,
          relatedEntityType: "Room",
          relatedEntityId: roomId,
        });
      }

      return `Room ${room.roomNumber}: ${assigneeName ? `assigned to ${assigneeName}` : "unassigned"}.`;
    });

    revalidateHousekeeping();
    return { status: "success", message };
  } catch (error) {
    if (error instanceof HousekeepingError) return { status: "error", error: error.message };
    throw error;
  }
}
