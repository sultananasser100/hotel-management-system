import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getReservationById } from "@/lib/reservations";
import { formatCurrency } from "@/lib/format";
import { SOURCE_LABEL } from "@/lib/reservation-constants";
import { Role } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReservationStatusBadge } from "@/components/dashboard/reservation-status-badge";
import { ReservationActionsMenu } from "../reservation-actions-menu";
import { PaymentsSection } from "./payments-section";

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  );
}

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("reservations");
  const { id } = await params;

  const reservation = await getReservationById(id);
  if (!reservation) notFound();

  const canManage = can(user.role, "reservations", "manage");
  const canViewGuests = can(user.role, "guests", "view");
  const canFrontDesk = can(user.role, "checkInOut", "manage");
  const canViewPayments = can(user.role, "payments", "view");
  const canManagePayments = can(user.role, "payments", "manage");
  const guestsLabel = `${reservation.adults} adult${reservation.adults === 1 ? "" : "s"}${
    reservation.children > 0
      ? `, ${reservation.children} child${reservation.children === 1 ? "" : "ren"}`
      : ""
  }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/reservations"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All reservations
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {reservation.confirmationCode}
            </h1>
            <ReservationStatusBadge status={reservation.status} />
          </div>
          {(canManage || canFrontDesk) && (
            <ReservationActionsMenu
              reservation={reservation}
              canManage={canManage}
              canFrontDesk={canFrontDesk}
              variant="button"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Stay</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              <InfoRow label="Check-in" value={reservation.checkInLabel} />
              <InfoRow label="Check-out" value={reservation.checkOutLabel} />
              <InfoRow
                label="Nights"
                value={`${reservation.nights} night${reservation.nights === 1 ? "" : "s"}`}
              />
              <InfoRow label="Guests" value={guestsLabel} />
              <InfoRow label="Rate per night" value={formatCurrency(reservation.effectiveRate)} />
              <InfoRow label="Total" value={formatCurrency(reservation.totalAmount)} />
              <InfoRow label="Source" value={SOURCE_LABEL[reservation.source]} />
              {reservation.actualCheckInLabel && (
                <InfoRow label="Checked in" value={reservation.actualCheckInLabel} />
              )}
              {reservation.actualCheckOutLabel && (
                <InfoRow label="Checked out" value={reservation.actualCheckOutLabel} />
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guest</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd className="flex items-center gap-2 text-sm">
                  {canViewGuests ? (
                    <Link
                      href={`/guests/${reservation.guest.id}`}
                      className="font-medium hover:underline"
                    >
                      {reservation.guest.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{reservation.guest.name}</span>
                  )}
                  {!reservation.guest.isActive && <Badge variant="secondary">Inactive</Badge>}
                </dd>
              </div>
              <InfoRow label="Email" value={reservation.guest.email} />
              <InfoRow label="Phone" value={reservation.guest.phone} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Room</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <InfoRow label="Room type" value={reservation.roomTypeName} />
              <InfoRow
                label="Room"
                value={
                  reservation.room
                    ? `Room ${reservation.room.roomNumber}${reservation.room.isActive ? "" : " (inactive)"}`
                    : "Not assigned yet"
                }
              />
            </dl>
          </CardContent>
        </Card>
      </div>

      {canViewPayments && (
        <PaymentsSection
          reservationId={reservation.id}
          confirmationCode={reservation.confirmationCode}
          reservationStatus={reservation.status}
          summary={reservation.paymentSummary}
          payments={reservation.payments}
          canManage={canManagePayments}
          isAdmin={user.role === Role.ADMIN}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Created by {reservation.createdByName} on {reservation.createdAtLabel} · Last updated{" "}
        {reservation.updatedAtLabel}
      </p>
    </div>
  );
}
