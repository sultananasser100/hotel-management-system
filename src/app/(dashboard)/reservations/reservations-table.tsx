"use client";

import Link from "next/link";
import { CalendarCheck, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";
import { ReservationStatusBadge } from "@/components/dashboard/reservation-status-badge";
import { ReservationActionsMenu } from "./reservation-actions-menu";
import { ReservationFilters } from "./reservation-filters";
import { RESERVATIONS_PAGE_SIZE } from "@/lib/reservation-constants";
import { formatCurrency } from "@/lib/format";
import type { ReservationListItem } from "@/lib/reservations";

type ReservationsTableProps = {
  reservations: ReservationListItem[];
  total: number;
  page: number;
  totalPages: number;
  filters: { q: string; status: string; from: string; to: string };
  canManage: boolean;
  canFrontDesk: boolean;
  canViewGuests: boolean;
};

export function ReservationsTable({
  reservations,
  total,
  page,
  totalPages,
  filters,
  canManage,
  canFrontDesk,
  canViewGuests,
}: ReservationsTableProps) {
  const hasFilters = Boolean(filters.q || filters.status || filters.from || filters.to);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>All reservations</CardTitle>
            <CardDescription>
              {hasFilters ? `${total} matching your filters` : `${total} reservations`}
            </CardDescription>
          </div>
          {canManage && (
            <Button asChild size="sm" className="w-fit">
              <Link href="/reservations/new">
                <Plus className="size-4" />
                New reservation
              </Link>
            </Button>
          )}
        </div>
        <ReservationFilters
          initialQuery={filters.q}
          initialStatus={filters.status}
          initialFrom={filters.from}
          initialTo={filters.to}
        />
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <CalendarCheck className="size-5" />
            <span>
              {hasFilters ? "No reservations match your filters." : "No reservations yet."}
            </span>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Confirmation</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead className="text-center">Nights</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {(canManage || canFrontDesk) && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link href={`/reservations/${r.id}`} className="hover:underline">
                        {r.confirmationCode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {canViewGuests ? (
                        <Link href={`/guests/${r.guestId}`} className="hover:underline">
                          {r.guestName}
                        </Link>
                      ) : (
                        r.guestName
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{r.roomTypeName}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.roomNumber ? `Room ${r.roomNumber}` : "Unassigned"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{r.checkInLabel}</TableCell>
                    <TableCell>{r.checkOutLabel}</TableCell>
                    <TableCell className="text-center">{r.nights}</TableCell>
                    <TableCell className="text-center">
                      <ReservationStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(r.totalAmount)}</TableCell>
                    {(canManage || canFrontDesk) && (
                      <TableCell className="text-right">
                        <ReservationActionsMenu
                          reservation={r}
                          canManage={canManage}
                          canFrontDesk={canFrontDesk}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <PaginationBar
              basePath="/reservations"
              params={filters}
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={RESERVATIONS_PAGE_SIZE}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
