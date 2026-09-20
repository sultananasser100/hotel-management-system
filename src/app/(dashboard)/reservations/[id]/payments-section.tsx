"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { PaymentStatus, ReservationStatus } from "@/generated/prisma/enums";
import { formatCurrency } from "@/lib/format";
import { PAYABLE_RESERVATION_STATUSES, PAYMENT_METHOD_LABEL } from "@/lib/payment-constants";
import { PAYMENT_STATE_LABEL, type PaymentSummary } from "@/lib/payment-balance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog";
import { PaymentRowActions } from "@/components/payments/payment-row-actions";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";

type PaymentRow = {
  id: string;
  amount: number;
  method: keyof typeof PAYMENT_METHOD_LABEL;
  status: PaymentStatus;
  reference: string | null;
  dateLabel: string;
  recordedBy: string;
};

type PaymentsSectionProps = {
  reservationId: string;
  confirmationCode: string;
  reservationStatus: ReservationStatus;
  summary: PaymentSummary;
  payments: PaymentRow[];
  // `payments` manage.
  canManage: boolean;
  isAdmin: boolean;
};

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tracking-tight">{value}</dd>
    </div>
  );
}

export function PaymentsSection({
  reservationId,
  confirmationCode,
  reservationStatus,
  summary,
  payments,
  canManage,
  isAdmin,
}: PaymentsSectionProps) {
  const [recording, setRecording] = useState(false);
  const closeDialog = useCallback(() => setRecording(false), []);

  const payable = PAYABLE_RESERVATION_STATUSES.includes(reservationStatus);
  const canRecordNow = canManage && payable && summary.balance > 0;

  let hint: string | null = null;
  if (canManage && !canRecordNow) {
    hint = !payable
      ? "Payments can't be recorded for cancelled or no-show reservations."
      : "Nothing left to pay.";
  }

  return (
    <Card id="payments" className="scroll-mt-20">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <CardTitle>Payments</CardTitle>
          <Badge variant={summary.state === "paid" ? "default" : "outline"}>
            {PAYMENT_STATE_LABEL[summary.state]}
          </Badge>
        </div>
        {canRecordNow && (
          <Button size="sm" onClick={() => setRecording(true)}>
            <Plus className="size-4" />
            Record payment
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure label="Total" value={formatCurrency(summary.total)} />
          <Figure label="Paid" value={formatCurrency(summary.paid)} />
          {summary.credit > 0 ? (
            <Figure
              label={summary.state === "refundable" ? "Refundable credit" : "Credit (overpaid)"}
              value={formatCurrency(summary.credit)}
            />
          ) : (
            <Figure label="Balance due" value={formatCurrency(summary.balance)} />
          )}
        </dl>

        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        {summary.credit > 0 && isAdmin && (
          <p className="text-sm text-muted-foreground">
            An administrator can refund a payment from the menu on its row.
          </p>
        )}

        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Recorded by</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{payment.dateLabel}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{PAYMENT_METHOD_LABEL[payment.method]}</span>
                      {payment.reference && (
                        <span className="text-xs text-muted-foreground">{payment.reference}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <PaymentStatusBadge status={payment.status} />
                  </TableCell>
                  <TableCell>{payment.recordedBy}</TableCell>
                  <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <PaymentRowActions
                        payment={payment}
                        canManage={canManage}
                        isAdmin={isAdmin}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {recording && (
        <RecordPaymentDialog
          reservationId={reservationId}
          confirmationCode={confirmationCode}
          balance={summary.balance}
          onClose={closeDialog}
        />
      )}
    </Card>
  );
}
