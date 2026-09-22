"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { HousekeepingTaskPriority } from "@/generated/prisma/enums";
import { assignHousekeeperAction, type AssignFormState } from "@/lib/actions/housekeeping";
import { MAX_TASK_NOTES_LENGTH, PRIORITY_LABEL } from "@/lib/housekeeping-rules";
import type { Housekeeper, HousekeepingRow } from "@/lib/housekeeping";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const initialState: AssignFormState = { status: "idle" };

type AssignDialogProps = {
  room: HousekeepingRow;
  housekeepers: Housekeeper[];
  onClose: () => void;
};

// Mounted only while open, so its fields start from the room's current task each time.
export function AssignDialog({ room, housekeepers, onClose }: AssignDialogProps) {
  const [state, formAction, pending] = useActionState(assignHousekeeperAction, initialState);
  const [assignee, setAssignee] = useState(room.task?.assigneeId ?? "none");
  const [priority, setPriority] = useState<string>(
    room.task?.priority ?? HousekeepingTaskPriority.MEDIUM,
  );
  const [notes, setNotes] = useState(room.task?.notes ?? "");

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onClose();
    }
  }, [state, onClose]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Assign room {room.roomNumber}</DialogTitle>
            <DialogDescription>Choose who cleans this room and how urgent it is.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="roomId" value={room.id} />
          <input type="hidden" name="expectedStatus" value={room.housekeepingStatus} />

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assign-assignee">Housekeeper</Label>
              <Select name="assignee" value={assignee} onValueChange={setAssignee}>
                <SelectTrigger id="assign-assignee" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {housekeepers.map((housekeeper) => (
                    <SelectItem key={housekeeper.id} value={housekeeper.id}>
                      {housekeeper.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assign-priority">Priority</Label>
              <Select name="priority" value={priority} onValueChange={setPriority}>
                <SelectTrigger id="assign-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(HousekeepingTaskPriority).map((value) => (
                    <SelectItem key={value} value={value}>
                      {PRIORITY_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assign-notes">Notes (optional)</Label>
              <Textarea
                id="assign-notes"
                name="notes"
                rows={3}
                maxLength={MAX_TASK_NOTES_LENGTH}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {state.status === "error" && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
