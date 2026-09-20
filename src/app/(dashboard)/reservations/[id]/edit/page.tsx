import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { todayDateOnly } from "@/lib/dashboard";
import { getReservationById, getReservationRoomTypes } from "@/lib/reservations";
import { toDateInputValue } from "@/lib/reservation-utils";
import { ReservationForm } from "../../reservation-form";

export default async function EditReservationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("reservations", "manage");
  const { id } = await params;

  const [reservation, roomTypes] = await Promise.all([
    getReservationById(id),
    getReservationRoomTypes(),
  ]);
  if (!reservation) notFound();
  // Checked-in/out, cancelled and no-show reservations are read-only here.
  if (!reservation.canEdit) redirect(`/reservations/${id}`);

  const today = toDateInputValue(todayDateOnly());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={`/reservations/${id}`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {reservation.confirmationCode}
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit {reservation.confirmationCode}
          </h1>
          <p className="text-muted-foreground">
            Changing dates, room type, or room re-checks availability.
          </p>
        </div>
      </div>

      <ReservationForm
        mode="edit"
        reservationId={reservation.id}
        roomTypes={roomTypes}
        minCheckIn={reservation.checkIn < today ? reservation.checkIn : today}
        defaults={{
          guest: { id: reservation.guest.id, name: reservation.guest.name },
          roomTypeId: reservation.roomTypeId,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          roomId: reservation.room?.id ?? "",
          adults: reservation.adults,
          children: reservation.children,
          source: reservation.source,
          status: reservation.status,
          totalAmount: reservation.totalAmount,
        }}
      />
    </div>
  );
}
