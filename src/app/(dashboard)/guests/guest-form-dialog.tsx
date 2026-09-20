"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createGuestAction, updateGuestAction, type GuestFormState } from "@/lib/actions/guests";
import { ID_DOCUMENT_TYPES } from "@/lib/guest-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { GuestDetail } from "@/lib/guests";

const initialState: GuestFormState = { status: "idle" };

type GuestFormDialogProps = {
  guest?: GuestDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GuestFormDialog({ guest, open, onOpenChange }: GuestFormDialogProps) {
  const isEdit = Boolean(guest);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateGuestAction : createGuestAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      toast.error(state.error);
    } else if (state.status === "success") {
      toast.success(isEdit ? "Guest updated." : "Guest created.");
      onOpenChange(false);
    }
  }, [state, isEdit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit guest" : "New guest"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update this guest's details." : "Add a new guest to the hotel."}
            </DialogDescription>
          </DialogHeader>

          {isEdit && <input type="hidden" name="id" value={guest!.id} />}

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-4 pr-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" defaultValue={guest?.firstName} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" defaultValue={guest?.lastName} required />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  defaultValue={guest?.email ?? ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="off"
                  defaultValue={guest?.phone ?? ""}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="idDocumentType">ID document type</Label>
                <Select name="idDocumentType" defaultValue={guest?.idDocumentType ?? "none"}>
                  <SelectTrigger id="idDocumentType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {ID_DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="idDocumentNumber">ID document number</Label>
                <Input
                  id="idDocumentNumber"
                  name="idDocumentNumber"
                  autoComplete="off"
                  defaultValue={guest?.idDocumentNumber ?? ""}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nationality">Nationality</Label>
              <Input id="nationality" name="nationality" defaultValue={guest?.nationality ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" rows={2} defaultValue={guest?.address ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} defaultValue={guest?.notes ?? ""} />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : isEdit ? "Save changes" : "Create guest"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
