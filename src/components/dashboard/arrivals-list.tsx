import { LogIn } from "lucide-react";
import type { ArrivalDeparture } from "@/lib/dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReservationStatusBadge } from "@/components/dashboard/reservation-status-badge";

export function ArrivalsList({ arrivals }: { arrivals: ArrivalDeparture[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s arrivals</CardTitle>
        <CardDescription>Guests checking in today</CardDescription>
      </CardHeader>
      <CardContent>
        {arrivals.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <LogIn className="size-5" />
            <span>No arrivals expected today.</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {arrivals.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.guestName}</TableCell>
                  <TableCell>{r.roomNumber ?? "Unassigned"}</TableCell>
                  <TableCell>
                    <ReservationStatusBadge status={r.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
