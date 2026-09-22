"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { HousekeepingStatus } from "@/generated/prisma/enums";
import { changeHousekeepingStatusAction } from "@/lib/actions/housekeeping";
import { transitionsFrom, type HousekeepingTransition } from "@/lib/housekeeping-rules";
import type { Housekeeper, HousekeepingRow } from "@/lib/housekeeping";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssignDialog } from "./assign-dialog";
import { HistoryDialog } from "./history-dialog";

type DialogKind = "dirty" | "takeover" | "assign" | "history";

type HousekeepingRowActionsProps = {
  room: HousekeepingRow;
  // `housekeeping` manage (ADMIN, HOUSEKEEPING). Receptionists only get History.
  canManage: boolean;
  isAdmin: boolean;
  currentUserId: string;
  housekeepers: Housekeeper[];
};

export function HousekeepingRowActions({
  room,
  canManage,
  isAdmin,
  currentUserId,
  housekeepers,
}: HousekeepingRowActionsProps) {
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [pending, startTransition] = useTransition();
  const closeDialog = useCallback(() => setDialog(null), []);

  const transitions = canManage
    ? transitionsFrom(room.housekeepingStatus).filter((t) => !t.adminOnly || isAdmin)
    : [];
  const showAssign =
    isAdmin &&
    (room.housekeepingStatus === HousekeepingStatus.DIRTY ||
      room.housekeepingStatus === HousekeepingStatus.IN_PROGRESS);
  const takeOverFrom =
    room.task?.assigneeId && room.task.assigneeId !== currentUserId ? room.task.assigneeName : null;

  function run(transition: HousekeepingTransition, takeOver = false) {
    startTransition(async () => {
      const result = await changeHousekeepingStatusAction(
        room.id,
        room.housekeepingStatus,
        transition.to,
        takeOver,
      );
      if (result.status === "error") {
        toast.error(result.error);
      } else {
        toast.success(result.message);
        setDialog(null);
      }
    });
  }

  function handleSelect(transition: HousekeepingTransition) {
    if (transition.confirm) {
      setDialog("dirty");
    } else if (transition.to === HousekeepingStatus.IN_PROGRESS && takeOverFrom) {
      setDialog("takeover");
    } else {
      run(transition);
    }
  }

  const dirtyTransition = transitions.find((t) => t.confirm);
  const startTransitionRule = transitions.find((t) => t.to === HousekeepingStatus.IN_PROGRESS);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={pending}>
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Room {room.roomNumber} actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {transitions.map((transition) => (
            <DropdownMenuItem
              key={`${transition.from}-${transition.to}`}
              onSelect={() => handleSelect(transition)}
            >
              {transition.label}
            </DropdownMenuItem>
          ))}
          {showAssign && (
            <DropdownMenuItem onSelect={() => setDialog("assign")}>
              Assign / priority
            </DropdownMenuItem>
          )}
          {(transitions.length > 0 || showAssign) && <DropdownMenuSeparator />}
          <DropdownMenuItem onSelect={() => setDialog("history")}>History</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "dirty"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark room {room.roomNumber} dirty</DialogTitle>
            <DialogDescription>
              The room will need cleaning again and is added to the cleaning queue as a new pending
              task.
              {room.inHouse ? " A guest is currently in this room." : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !dirtyTransition}
              onClick={() => dirtyTransition && run(dirtyTransition)}
            >
              {pending ? "Working..." : "Mark dirty"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "takeover"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take over cleaning of room {room.roomNumber}?</DialogTitle>
            <DialogDescription>
              This cleaning is assigned to {takeOverFrom}. Starting it will assign it to you.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={pending || !startTransitionRule}
              onClick={() => startTransitionRule && run(startTransitionRule, true)}
            >
              {pending ? "Working..." : "Take over and start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialog === "assign" && (
        <AssignDialog room={room} housekeepers={housekeepers} onClose={closeDialog} />
      )}
      {dialog === "history" && (
        <HistoryDialog roomId={room.id} roomNumber={room.roomNumber} onClose={closeDialog} />
      )}
    </>
  );
}
