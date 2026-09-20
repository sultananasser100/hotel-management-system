"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { checkInReservationAction, type CheckInFormState } from "@/lib/actions/front-desk";
import { ID_DOCUMENT_TYPES } from "@/lib/guest-constants";
import { HOUSEKEEPING_STATUS_LABEL, READY_HOUSEKEEPING_STATUSES } from "@/lib/front-desk-rules";
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
import { useFrontDeskInfo } from "./use-front-desk-info";

const initialState: CheckInFormState = { status: "idle" };

type CheckInDialogProps = {
  reservationId: string;
  confirmationCode: string;
  onClose: () => void;
};

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

// Mounted only while open, so all of its state starts fresh for each reservation.
export function CheckInDialog({ reservationId, confirmationCode, onClose }: CheckInDialogProps) {
  const { info, error, loading } = useFrontDeskInfo(reservationId);
  const [state, formAction, pending] = useActionState(checkInReservationAction, initialState);
  const [roomId, setRoomId] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onClose();
    }
  }, [state, onClose]);

  const checkIn = info?.checkIn ?? null;
  const reservation = info?.reservation;

  const effectiveRoomId = checkIn
    ? checkIn.needsRoomChoice
      ? roomId
      : (checkIn.assignedRoom?.id ?? "")
    : "";
  const chosenRoom = checkIn
    ? (checkIn.roomOptions.find((room) => room.id === effectiveRoomId) ??
      (checkIn.assignedRoom?.id === effectiveRoomId ? checkIn.assignedRoom : null))
    : null;
  const roomNotReady =
    chosenRoom !== null && !READY_HOUSEKEEPING_STATUSES.includes(chosenRoom.housekeepingStatus);
  const idReady = checkIn
    ? Boolean(checkIn.idOnFile) || (idType !== "" && idNumber.trim() !== "")
    : false;
  const canSubmit =
    checkIn !== null &&
    checkIn.blockers.length === 0 &&
    effectiveRoomId !== "" &&
    idReady &&
    verified &&
    !pending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Check in {confirmationCode}</DialogTitle>
            <DialogDescription>
              Confirm the room and the guest&apos;s ID, then check the guest in.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="reservationId" value={reservationId} />
          <input type="hidden" name="roomId" value={effectiveRoomId} />

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-4 pr-1">
            {loading && <p className="text-sm text-muted-foreground">Loading details...</p>}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {info && !checkIn && (
              <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {info.unavailableReason ?? "This reservation can't be checked in."}
              </p>
            )}

            {reservation && (
              <dl className="grid grid-cols-2 gap-3">
                <Summary label="Guest" value={reservation.guestName} />
                <Summary label="Room type" value={reservation.roomTypeName} />
                <Summary
                  label="Stay"
                  value={`${reservation.checkInLabel} → ${reservation.checkOutLabel}`}
                />
                <Summary
                  label="Party"
                  value={`${reservation.adults} adult${reservation.adults === 1 ? "" : "s"}${
                    reservation.children > 0
                      ? `, ${reservation.children} child${reservation.children === 1 ? "" : "ren"}`
                      : ""
                  } · ${reservation.nights} night${reservation.nights === 1 ? "" : "s"}`}
                />
              </dl>
            )}

            {checkIn && (
              <>
                {checkIn.blockers.length > 0 && (
                  <div
                    role="alert"
                    className="flex flex-col gap-1 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {checkIn.blockers.map((blocker) => (
                      <p key={blocker}>{blocker}</p>
                    ))}
                  </div>
                )}
                {(checkIn.warnings.length > 0 || roomNotReady) && (
                  <div className="flex flex-col gap-1 rounded-lg bg-muted p-3 text-sm">
                    {checkIn.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                    {roomNotReady && chosenRoom && checkIn.needsRoomChoice && (
                      <p>
                        Room {chosenRoom.roomNumber} is not ready:{" "}
                        {HOUSEKEEPING_STATUS_LABEL[chosenRoom.housekeepingStatus].toLowerCase()}.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="checkin-room">Room</Label>
                  {checkIn.needsRoomChoice ? (
                    <Select value={roomId} onValueChange={setRoomId}>
                      <SelectTrigger id="checkin-room" className="w-full">
                        <SelectValue placeholder="Select a room" />
                      </SelectTrigger>
                      <SelectContent>
                        {checkIn.roomOptions.map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.roomNumber} (floor {room.floor}) —{" "}
                            {HOUSEKEEPING_STATUS_LABEL[room.housekeepingStatus]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">
                      Room {checkIn.assignedRoom?.roomNumber} (floor {checkIn.assignedRoom?.floor})
                      —{" "}
                      {checkIn.assignedRoom
                        ? HOUSEKEEPING_STATUS_LABEL[checkIn.assignedRoom.housekeepingStatus]
                        : ""}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Guest ID document</Label>
                  {checkIn.idOnFile ? (
                    <p className="text-sm">
                      {checkIn.idOnFile.type} · {checkIn.idOnFile.masked}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Select name="idDocumentType" value={idType} onValueChange={setIdType}>
                        <SelectTrigger className="w-full" aria-label="ID document type">
                          <SelectValue placeholder="Document type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ID_DOCUMENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        name="idDocumentNumber"
                        aria-label="ID document number"
                        placeholder="Document number"
                        autoComplete="off"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground sm:col-span-2">
                        No ID is on file for this guest. It will be saved to their profile.
                      </p>
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="idVerified"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  I have verified the guest&apos;s ID document.
                </label>
              </>
            )}

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
            <Button type="submit" disabled={!canSubmit}>
              {pending ? "Checking in..." : "Check in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
