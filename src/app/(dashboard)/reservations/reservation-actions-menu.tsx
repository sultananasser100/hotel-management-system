"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { ReservationStatus } from "@/generated/prisma/enums";
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
import { CheckInDialog } from "@/components/front-desk/check-in-dialog";
import { CheckOutDialog } from "@/components/front-desk/check-out-dialog";
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
    canCheckIn: boolean;
    checkInBlockedReason: string | null;
    canCheckOut: boolean;
  };
  // Phase 8 actions (edit / confirm / cancel / no-show) need `reservations` manage.
  canManage: boolean;
  // Check in / check out need `checkInOut` manage.
  canFrontDesk: boolean;
  variant?: "icon" | "button";
};

export function ReservationActionsMenu({
  reservation,
  canManage,
  canFrontDesk,
  variant = "icon",
}: ReservationActionsMenuProps) {
  const [action, setAction] = useState<StatusAction | null>(null);
  const [frontDesk, setFrontDesk] = useState<"in" | "out" | null>(null);
  const [pending, startTransition] = useTransition();
  const closeFrontDesk = useCallback(() => setFrontDesk(null), []);

  const showEdit = canManage && reservation.canEdit;
  const showConfirm = canManage && reservation.status === ReservationStatus.PENDING;
  const showNoShow = canManage && reservation.canMarkNoShow;
  const showCancel = canManage && reservation.canEdit;
  const showCheckIn = canFrontDesk && reservation.status === ReservationStatus.CONFIRMED;
  const showCheckOut = canFrontDesk && reservation.canCheckOut;
  const showFrontDesk = showCheckIn || showCheckOut;
  const showManage = showEdit || showConfirm || showNoShow || showCancel;

  if (!showFrontDesk && !showManage) return null;

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
        <DropdownMenuContent align="end" className="min-w-44">
          {showCheckIn && (
            <DropdownMenuItem
              disabled={!reservation.canCheckIn}
              onSelect={() => setFrontDesk("in")}
              className="flex-col items-start gap-0"
            >
              <span>Check in</span>
              {!reservation.canCheckIn && reservation.checkInBlockedReason && (
                <span className="text-xs text-muted-foreground">
                  {reservation.checkInBlockedReason}
                </span>
              )}
            </DropdownMenuItem>
          )}
          {showCheckOut && (
            <DropdownMenuItem onSelect={() => setFrontDesk("out")}>Check out</DropdownMenuItem>
          )}
          {showFrontDesk && showManage && <DropdownMenuSeparator />}
          {showEdit && (
            <DropdownMenuItem asChild>
              <Link href={`/reservations/${reservation.id}/edit`}>Edit</Link>
            </DropdownMenuItem>
          )}
          {showConfirm && (
            <DropdownMenuItem onSelect={() => setAction("confirm")}>Confirm</DropdownMenuItem>
          )}
          {showNoShow && (
            <DropdownMenuItem onSelect={() => setAction("noShow")}>Mark no-show</DropdownMenuItem>
          )}
          {showCancel && (
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

      {frontDesk === "in" && (
        <CheckInDialog
          reservationId={reservation.id}
          confirmationCode={reservation.confirmationCode}
          onClose={closeFrontDesk}
        />
      )}
      {frontDesk === "out" && (
        <CheckOutDialog
          reservationId={reservation.id}
          confirmationCode={reservation.confirmationCode}
          onClose={closeFrontDesk}
        />
      )}
    </>
  );
}
