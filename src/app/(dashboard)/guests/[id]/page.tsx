import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getGuestById } from "@/lib/guests";
import { formatDateOnly } from "@/lib/format";
import { displayNationality } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GuestActions } from "./guest-actions";
import { ReservationHistory } from "./reservation-history";

function maskDocumentNumber(value: string): string {
  return value.length <= 4 ? "••••" : `•••• ${value.slice(-4)}`;
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm whitespace-pre-line">{value ?? "—"}</dd>
    </div>
  );
}

export default async function GuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("guests");
  const { id } = await params;

  const data = await getGuestById(id);
  if (!data) notFound();

  const { guest, history, summary } = data;
  const canManage = can(user.role, "guests", "manage");
  const canViewReservations = can(user.role, "reservations", "view");
  const canBook = can(user.role, "reservations", "manage") && guest.isActive;

  const tiles = [
    { label: "Total reservations", value: String(summary.totalReservations) },
    { label: "Completed stays", value: String(summary.completedStays) },
    { label: "Upcoming reservations", value: String(summary.upcomingReservations) },
    {
      label: "Last check-out",
      value: summary.lastCheckOut ? formatDateOnly(summary.lastCheckOut) : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/guests"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All guests
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {guest.firstName} {guest.lastName}
            </h1>
            {!guest.isActive && <Badge variant="secondary">Inactive</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {canBook && (
              <Button asChild size="sm">
                <Link href={`/reservations/new?guestId=${guest.id}`}>
                  <Plus className="size-4" />
                  New reservation
                </Link>
              </Button>
            )}
            {canManage && <GuestActions guest={guest} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <span className="text-sm text-muted-foreground">{tile.label}</span>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold tracking-tight">{tile.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <InfoRow label="Email" value={guest.email} />
              <InfoRow label="Phone" value={guest.phone} />
              <InfoRow label="Address" value={guest.address} />
              <InfoRow label="Nationality" value={displayNationality(guest.nationality)} />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Identification</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <InfoRow label="Document type" value={guest.idDocumentType} />
              <InfoRow
                label="Document number"
                value={guest.idDocumentNumber ? maskDocumentNumber(guest.idDocumentNumber) : null}
              />
              <InfoRow label="Guest since" value={formatDateOnly(guest.createdAt)} />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">
              {guest.notes ?? <span className="text-muted-foreground">No notes.</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      {canViewReservations && <ReservationHistory history={history} />}
    </div>
  );
}
