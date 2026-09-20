"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { PaymentMethod } from "@/generated/prisma/enums";
import { recordPaymentAction, type RecordPaymentState } from "@/lib/actions/payments";
import { formatCurrency } from "@/lib/format";
import { MAX_REFERENCE_LENGTH, PAYMENT_METHOD_LABEL } from "@/lib/payment-constants";
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

const initialState: RecordPaymentState = { status: "idle" };

type RecordPaymentDialogProps = {
  reservationId: string;
  confirmationCode: string;
  balance: number;
  onClose: () => void;
};

// Mounted only while open, so its state starts fresh each time.
export function RecordPaymentDialog({
  reservationId,
  confirmationCode,
  balance,
  onClose,
}: RecordPaymentDialogProps) {
  const [state, formAction, pending] = useActionState(recordPaymentAction, initialState);
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [method, setMethod] = useState<string>(PaymentMethod.CASH);
  const [reference, setReference] = useState("");

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
            <DialogTitle>Record payment for {confirmationCode}</DialogTitle>
            <DialogDescription>
              Remaining balance: {formatCurrency(balance)}. Record money that has been received.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="reservationId" value={reservationId} />

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment-amount">Amount ($)</Label>
              <div className="flex gap-2">
                <Input
                  id="payment-amount"
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max={balance}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setAmount(balance.toFixed(2))}
                >
                  Full balance
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment-method">Method</Label>
              <Select name="method" value={method} onValueChange={setMethod}>
                <SelectTrigger id="payment-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(PaymentMethod).map((value) => (
                    <SelectItem key={value} value={value}>
                      {PAYMENT_METHOD_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment-reference">Reference (optional)</Label>
              <Input
                id="payment-reference"
                name="reference"
                maxLength={MAX_REFERENCE_LENGTH}
                autoComplete="off"
                placeholder="Receipt or transaction number"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Never enter a card number. Card and online payments are taken outside this system.
              </p>
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
            <Button type="submit" disabled={pending || amount === ""}>
              {pending ? "Recording..." : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
