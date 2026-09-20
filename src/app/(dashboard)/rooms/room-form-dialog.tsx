"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createRoomAction, updateRoomAction, type RoomFormState } from "@/lib/actions/rooms";
import { RoomStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ROOM_STATUS_LABEL } from "./room-status";
import type { RoomListItem, RoomTypeOption } from "@/lib/rooms";

const initialState: RoomFormState = { status: "idle" };

type RoomFormDialogProps = {
  room?: RoomListItem;
  roomTypes: RoomTypeOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RoomFormDialog({ room, roomTypes, open, onOpenChange }: RoomFormDialogProps) {
  const isEdit = Boolean(room);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateRoomAction : createRoomAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.error);
    } else if (state.status === "success") {
      toast.success(isEdit ? "Room updated." : "Room created.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit room" : "New room"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update the details for this room." : "Add a new room to the hotel."}
            </DialogDescription>
          </DialogHeader>

          {isEdit && <input type="hidden" name="id" value={room!.id} />}

          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="roomNumber">Room number</Label>
                <Input id="roomNumber" name="roomNumber" defaultValue={room?.roomNumber} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="floor">Floor</Label>
                <Input
                  id="floor"
                  name="floor"
                  type="number"
                  step="1"
                  defaultValue={room?.floor}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="roomTypeId">Room type</Label>
              <Select name="roomTypeId" defaultValue={room?.roomTypeId} required>
                <SelectTrigger id="roomTypeId" className="w-full">
                  <SelectValue placeholder="Select a room type" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={room?.status ?? RoomStatus.AVAILABLE} required>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(RoomStatus).map((status) => (
                    <SelectItem key={status} value={status}>
                      {ROOM_STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : isEdit ? "Save changes" : "Create room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
