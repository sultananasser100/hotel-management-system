"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { PaymentStatus } from "@/generated/prisma/enums";
import {
  markPaymentReceivedAction,
  refundPaymentAction,
  voidPaymentAction,
} from "@/lib/actions/payments";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/payment-constants";
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

type RowAction = "receive" | "void" | "refund";

const ACTIONS: Record<
  RowAction,
  {
    run: typeof markPaymentReceivedAction;
    title: string;
    description: string;
    button: string;
    destructive: boolean;
  }
> = {
  receive: {
    run: markPaymentReceivedAction,
    title: "Mark payment as received",
    description:
      "The payment is recorded as received now and counts toward the reservation's balance.",
    button: "Mark received",
    destructive: false,
  },
  void: {
    run: voidPaymentAction,
    title: "Void payment",
    description:
      "Use this for a payment entered in error. It stops counting toward the balance and can't be undone. To correct it, record the right payment afterwards.",
    button: "Void payment",
    destructive: true,
  },
  refund: {
    run: refundPaymentAction,
    title: "Refund payment",
    description:
      "The whole payment is marked as refunded and stops counting toward the balance. This can't be undone. It only records the refund; hand the money back separately.",
    button: "Refund payment",
    destructive: true,
  },
};

type PaymentRowActionsProps = {
  payment: {
    id: string;
    status: PaymentStatus;
    amount: number;
    method: keyof typeof PAYMENT_METHOD_LABEL;
  };
  // `payments` manage: may mark pending payments as received.
  canManage: boolean;
  // Void and refund are administrator-only (also enforced on the server).
  isAdmin: boolean;
};

export function PaymentRowActions({ payment, canManage, isAdmin }: PaymentRowActionsProps) {
  const [action, setAction] = useState<RowAction | null>(null);
  const [pending, startTransition] = useTransition();

  const showReceive = canManage && payment.status === PaymentStatus.PENDING;
  const showVoid =
    isAdmin &&
    (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.COMPLETED);
  const showRefund = isAdmin && payment.status === PaymentStatus.COMPLETED;

  if (!showReceive && !showVoid && !showRefund) return null;

  const copy = ACTIONS[action ?? "receive"];

  function handleRun() {
    if (!action) return;
    const current = ACTIONS[action];
    startTransition(async () => {
      const result = await current.run(payment.id);
      if (result.status === "error") {
        toast.error(result.error);
      } else {
        toast.success(result.message);
        setAction(null);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Payment actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showReceive && (
            <DropdownMenuItem onSelect={() => setAction("receive")}>Mark received</DropdownMenuItem>
          )}
          {showRefund && (
            <DropdownMenuItem onSelect={() => setAction("refund")}>Refund</DropdownMenuItem>
          )}
          {showVoid && (
            <DropdownMenuItem variant="destructive" onSelect={() => setAction("void")}>
              Void
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>
              {formatCurrency(payment.amount)} · {PAYMENT_METHOD_LABEL[payment.method]}.{" "}
              {copy.description}
            </DialogDescription>
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
