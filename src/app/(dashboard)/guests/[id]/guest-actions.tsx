"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuestFormDialog } from "../guest-form-dialog";
import { DeactivateGuestDialog } from "../deactivate-guest-dialog";
import { restoreGuestAction } from "@/lib/actions/guests";
import type { GuestDetail } from "@/lib/guests";

export function GuestActions({ guest }: { guest: GuestDetail }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const fullName = `${guest.firstName} ${guest.lastName}`;

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreGuestAction(guest.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${fullName} restored.`);
      }
    });
  }

  if (!guest.isActive) {
    return (
      <Button variant="outline" size="sm" disabled={pending} onClick={handleRestore}>
        <RotateCcw className="size-4" />
        {pending ? "Restoring..." : "Restore"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil className="size-4" />
        Edit
      </Button>
      <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="size-4" />
        Delete
      </Button>
      <GuestFormDialog guest={guest} open={editOpen} onOpenChange={setEditOpen} />
      <DeactivateGuestDialog
        guestId={guest.id}
        guestName={fullName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
