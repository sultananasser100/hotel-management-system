import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, PAYMENTS_PAGE_SIZE } from "@/lib/payment-constants";
import type { PaymentLedgerItem } from "@/lib/payments";
import { PaymentFilters } from "./payment-filters";

type PaymentsTableProps = {
  payments: PaymentLedgerItem[];
  total: number;
  page: number;
  totalPages: number;
  filters: { q: string; status: string; method: string; from: string; to: string };
};

// Read-only ledger: payments are recorded, and voided/refunded, from the reservation page.
export function PaymentsTable({ payments, total, page, totalPages, filters }: PaymentsTableProps) {
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div>
          <CardTitle>All payments</CardTitle>
          <CardDescription>
            {hasFilters ? `${total} matching your filters` : `${total} payments`}
          </CardDescription>
        </div>
        <PaymentFilters
          initialQuery={filters.q}
          initialStatus={filters.status}
          initialMethod={filters.method}
          initialFrom={filters.from}
          initialTo={filters.to}
        />
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <CreditCard className="size-5" />
            <span>{hasFilters ? "No payments match your filters." : "No payments yet."}</span>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reservation</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.dateLabel}</TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/reservations/${payment.reservationId}#payments`}
                        className="hover:underline"
                      >
                        {payment.confirmationCode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/guests/${payment.guestId}`} className="hover:underline">
                        {payment.guestName}
                      </Link>
                    </TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <PaginationBar
              basePath="/payments"
              params={filters}
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAYMENTS_PAGE_SIZE}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
