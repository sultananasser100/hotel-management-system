import { LogOut } from "lucide-react";
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

export function DeparturesList({ departures }: { departures: ArrivalDeparture[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s departures</CardTitle>
        <CardDescription>Guests checking out today</CardDescription>
      </CardHeader>
      <CardContent>
        {departures.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <LogOut className="size-5" />
            <span>No departures expected today.</span>
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
              {departures.map((r) => (
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
