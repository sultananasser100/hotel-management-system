"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { checkOutReservationAction } from "@/lib/actions/front-desk";
import { formatCurrency } from "@/lib/format";
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
import { useFrontDeskInfo } from "./use-front-desk-info";

type CheckOutDialogProps = {
  reservationId: string;
  confirmationCode: string;
  onClose: () => void;
};

// Mounted only while open, so its state starts fresh for each reservation.
export function CheckOutDialog({ reservationId, confirmationCode, onClose }: CheckOutDialogProps) {
  const { info, error, loading } = useFrontDeskInfo(reservationId);
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const checkOut = info?.checkOut ?? null;
  const reservation = info?.reservation;

  function handleCheckOut() {
    startTransition(async () => {
      const result = await checkOutReservationAction(reservationId);
      if (result.status === "error") {
        setSubmitError(result.error);
        toast.error(result.error);
      } else {
        toast.success(result.message);
        onClose();
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check out {confirmationCode}</DialogTitle>
          <DialogDescription>
            {checkOut?.roomNumber
              ? `Room ${checkOut.roomNumber} will be marked Available and flagged Dirty for housekeeping.`
              : "The guest will be checked out."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          {loading && <p className="text-muted-foreground">Loading details...</p>}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {info && !checkOut && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive">
              Only checked-in reservations can be checked out.
            </p>
          )}

          {reservation && checkOut && (
            <>
              <dl className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Guest</dt>
                  <dd>{reservation.guestName}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Room</dt>
                  <dd>{checkOut.roomNumber ? `Room ${checkOut.roomNumber}` : "—"}</dd>
                </div>
                <div className="col-span-2 flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">Departure</dt>
                  <dd>{checkOut.departure}</dd>
                </div>
              </dl>

              {checkOut.balance > 0 ? (
                <p className="rounded-lg bg-muted p-3">
                  Outstanding balance of {formatCurrency(checkOut.balance)} (paid{" "}
                  {formatCurrency(checkOut.paidAmount)} of {formatCurrency(checkOut.totalAmount)}).
                  You can still check the guest out.
                  {checkOut.canRecordPayment && (
                    <>
                      {" "}
                      <Link
                        href={`/reservations/${reservationId}#payments`}
                        onClick={onClose}
                        className="font-medium underline underline-offset-2"
                      >
                        Record a payment
                      </Link>
                    </>
                  )}
                </p>
              ) : checkOut.credit > 0 ? (
                <p className="rounded-lg bg-muted p-3">
                  Paid in full, with a credit of {formatCurrency(checkOut.credit)} (overpaid).
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Paid in full ({formatCurrency(checkOut.totalAmount)}).
                </p>
              )}
            </>
          )}

          {submitError && (
            <p role="alert" className="text-destructive">
              {submitError}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" disabled={!checkOut || pending} onClick={handleCheckOut}>
            {pending ? "Checking out..." : "Check out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
