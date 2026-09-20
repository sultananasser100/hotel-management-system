"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deactivateGuestAction } from "@/lib/actions/guests";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeactivateGuestDialogProps = {
  guestId: string;
  guestName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeactivateGuestDialog({
  guestId,
  guestName,
  open,
  onOpenChange,
}: DeactivateGuestDialogProps) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deactivateGuestAction(guestId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${guestName} deleted.`);
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {guestName}</DialogTitle>
          <DialogDescription>
            The guest will be marked inactive and stay in the list, where they can be restored
            later. Their reservation history is kept.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
