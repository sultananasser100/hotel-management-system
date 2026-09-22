import {
  HousekeepingStatus,
  HousekeepingTaskPriority,
  HousekeepingTaskStatus,
} from "@/generated/prisma/enums";

export const HOUSEKEEPING_PAGE_SIZE = 20;
export const MAX_TASK_NOTES_LENGTH = 500;

export const HOUSEKEEPING_STATE_LABEL: Record<HousekeepingStatus, string> = {
  CLEAN: "Clean",
  DIRTY: "Dirty",
  IN_PROGRESS: "In progress",
  INSPECTED: "Inspected",
};

export const PRIORITY_LABEL: Record<HousekeepingTaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

// The room's housekeeping status is the visible truth; its CLEANING task mirrors it:
// DIRTY <-> PENDING, IN_PROGRESS <-> IN_PROGRESS, CLEAN <-> COMPLETED, INSPECTED <-> VERIFIED.
export const TASK_STATUS_FOR_ROOM_STATUS: Record<HousekeepingStatus, HousekeepingTaskStatus> = {
  DIRTY: HousekeepingTaskStatus.PENDING,
  IN_PROGRESS: HousekeepingTaskStatus.IN_PROGRESS,
  CLEAN: HousekeepingTaskStatus.COMPLETED,
  INSPECTED: HousekeepingTaskStatus.VERIFIED,
};

// A room has at most one open CLEANING task.
export const OPEN_TASK_STATUSES: HousekeepingTaskStatus[] = [
  HousekeepingTaskStatus.PENDING,
  HousekeepingTaskStatus.IN_PROGRESS,
];

export type HousekeepingTransition = {
  from: HousekeepingStatus;
  to: HousekeepingStatus;
  label: string;
  logAction: string;
  adminOnly: boolean;
  // The UI asks for confirmation before running it.
  confirm: boolean;
};

// The only transitions that exist. Anything else is rejected.
export const HOUSEKEEPING_TRANSITIONS: HousekeepingTransition[] = [
  {
    from: HousekeepingStatus.DIRTY,
    to: HousekeepingStatus.IN_PROGRESS,
    label: "Start cleaning",
    logAction: "START_CLEANING",
    adminOnly: false,
    confirm: false,
  },
  {
    from: HousekeepingStatus.IN_PROGRESS,
    to: HousekeepingStatus.CLEAN,
    label: "Mark clean",
    logAction: "COMPLETE_CLEANING",
    adminOnly: false,
    confirm: false,
  },
  {
    from: HousekeepingStatus.CLEAN,
    to: HousekeepingStatus.INSPECTED,
    label: "Inspect",
    logAction: "INSPECT_ROOM",
    adminOnly: true,
    confirm: false,
  },
  {
    from: HousekeepingStatus.CLEAN,
    to: HousekeepingStatus.DIRTY,
    label: "Mark dirty",
    logAction: "MARK_ROOM_DIRTY",
    adminOnly: false,
    confirm: true,
  },
  {
    from: HousekeepingStatus.INSPECTED,
    to: HousekeepingStatus.DIRTY,
    label: "Mark dirty",
    logAction: "MARK_ROOM_DIRTY",
    adminOnly: false,
    confirm: true,
  },
];

export function findTransition(
  from: HousekeepingStatus,
  to: HousekeepingStatus,
): HousekeepingTransition | undefined {
  return HOUSEKEEPING_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function transitionsFrom(from: HousekeepingStatus): HousekeepingTransition[] {
  return HOUSEKEEPING_TRANSITIONS.filter((t) => t.from === from);
}

export const HOUSEKEEPING_LOG_ACTIONS = [
  "START_CLEANING",
  "COMPLETE_CLEANING",
  "INSPECT_ROOM",
  "MARK_ROOM_DIRTY",
  "ASSIGN_HOUSEKEEPER",
];

export const HOUSEKEEPING_LOG_LABEL: Record<string, string> = {
  START_CLEANING: "Started cleaning",
  COMPLETE_CLEANING: "Marked clean",
  INSPECT_ROOM: "Inspected",
  MARK_ROOM_DIRTY: "Marked dirty",
  ASSIGN_HOUSEKEEPER: "Assignment changed",
};

export const HOUSEKEEPING_TASK_STATUS_LABEL: Record<HousekeepingTaskStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  VERIFIED: "Verified",
};
