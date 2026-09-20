import { CalendarCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReservationStatusBadge } from "@/components/dashboard/reservation-status-badge";
import { formatCurrency, formatDateOnly } from "@/lib/format";
import type { GuestHistoryItem } from "@/lib/guests";

// Read-only on purpose: reservation pages and actions arrive in Phase 8.
export function ReservationHistory({ history }: { history: GuestHistoryItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reservation history</CardTitle>
        <CardDescription>
          {history.length} reservation{history.length === 1 ? "" : "s"}, newest first
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <CalendarCheck className="size-5" />
            <span>No reservations yet.</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Confirmation</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead className="text-center">Nights</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.confirmationCode}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{r.roomTypeName}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.roomNumber ? `Room ${r.roomNumber}` : "Unassigned"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{formatDateOnly(r.checkInDate)}</TableCell>
                  <TableCell>{formatDateOnly(r.checkOutDate)}</TableCell>
                  <TableCell className="text-center">{r.nights}</TableCell>
                  <TableCell className="text-center">
                    <ReservationStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(r.totalAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
