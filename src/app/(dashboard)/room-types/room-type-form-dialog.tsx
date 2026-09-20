"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  createRoomTypeAction,
  updateRoomTypeAction,
  type RoomTypeFormState,
} from "@/lib/actions/room-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RoomTypeListItem } from "@/lib/room-types";

const initialState: RoomTypeFormState = { status: "idle" };

type RoomTypeFormDialogProps = {
  roomType?: RoomTypeListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RoomTypeFormDialog({ roomType, open, onOpenChange }: RoomTypeFormDialogProps) {
  const isEdit = Boolean(roomType);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateRoomTypeAction : createRoomTypeAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.error);
    } else if (state.status === "success") {
      toast.success(isEdit ? "Room type updated." : "Room type created.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit room type" : "New room type"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the details for this room type."
                : "Add a new room type guests can be booked into."}
            </DialogDescription>
          </DialogHeader>

          {isEdit && <input type="hidden" name="id" value={roomType!.id} />}

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={roomType?.name} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={roomType?.description ?? ""}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="basePrice">Base price ($)</Label>
                <Input
                  id="basePrice"
                  name="basePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={roomType?.basePrice}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="maxOccupancy">Max occupancy</Label>
                <Input
                  id="maxOccupancy"
                  name="maxOccupancy"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={roomType?.maxOccupancy}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amenities">Amenities</Label>
              <Textarea
                id="amenities"
                name="amenities"
                defaultValue={roomType?.amenities.join(", ") ?? ""}
                rows={2}
                placeholder="Free Wi-Fi, Air conditioning, TV"
              />
              <p className="text-xs text-muted-foreground">Separate amenities with commas.</p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : isEdit ? "Save changes" : "Create room type"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
