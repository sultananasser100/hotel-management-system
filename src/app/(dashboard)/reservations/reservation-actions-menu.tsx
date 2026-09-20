"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { ReservationStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  cancelReservationAction,
  confirmReservationAction,
  markNoShowAction,
} from "@/lib/actions/reservations";

type StatusAction = "confirm" | "cancel" | "noShow";

const ACTIONS: Record<
  StatusAction,
  {
    run: typeof confirmReservationAction;
    title: string;
    description: string;
    button: string;
    success: string;
    destructive: boolean;
  }
> = {
  confirm: {
    run: confirmReservationAction,
    title: "Confirm reservation",
    description: "The reservation will be marked as confirmed.",
    button: "Confirm",
    success: "Reservation confirmed.",
    destructive: false,
  },
  cancel: {
    run: cancelReservationAction,
    title: "Cancel reservation",
    description:
      "The room is released for these dates. Any payments already recorded are not changed.",
    button: "Cancel reservation",
    success: "Reservation cancelled.",
    destructive: true,
  },
  noShow: {
    run: markNoShowAction,
    title: "Mark as no-show",
    description: "The guest did not arrive. The room is released for these dates.",
    button: "Mark no-show",
    success: "Reservation marked as no-show.",
    destructive: true,
  },
};

type ReservationActionsMenuProps = {
  reservation: {
    id: string;
    confirmationCode: string;
    status: ReservationStatus;
    canEdit: boolean;
    canMarkNoShow: boolean;
  };
  variant?: "icon" | "button";
};

export function ReservationActionsMenu({
  reservation,
  variant = "icon",
}: ReservationActionsMenuProps) {
  const [action, setAction] = useState<StatusAction | null>(null);
  const [pending, startTransition] = useTransition();

  const canConfirm = reservation.status === ReservationStatus.PENDING;
  if (!reservation.canEdit && !reservation.canMarkNoShow) return null;

  const copy = ACTIONS[action ?? "confirm"];

  function handleRun() {
    if (!action) return;
    const current = ACTIONS[action];
    startTransition(async () => {
      const result = await current.run(reservation.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${reservation.confirmationCode}: ${current.success}`);
        setAction(null);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "icon" ? (
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Actions</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <MoreHorizontal className="size-4" />
              Actions
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {reservation.canEdit && (
            <DropdownMenuItem asChild>
              <Link href={`/reservations/${reservation.id}/edit`}>Edit</Link>
            </DropdownMenuItem>
          )}
          {canConfirm && (
            <DropdownMenuItem onSelect={() => setAction("confirm")}>Confirm</DropdownMenuItem>
          )}
          {reservation.canMarkNoShow && (
            <DropdownMenuItem onSelect={() => setAction("noShow")}>Mark no-show</DropdownMenuItem>
          )}
          {reservation.canEdit && (
            <DropdownMenuItem variant="destructive" onSelect={() => setAction("cancel")}>
              Cancel reservation
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {copy.title} {reservation.confirmationCode}
            </DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Back
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant={copy.destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={handleRun}
            >
              {pending ? "Working..." : copy.button}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
