import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { todayDateOnly } from "@/lib/dashboard";
import { getActiveGuestOption, getReservationRoomTypes } from "@/lib/reservations";
import { toDateInputValue } from "@/lib/reservation-utils";
import { ReservationSource, ReservationStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReservationForm } from "../reservation-form";

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission("reservations", "manage");
  const params = await searchParams;

  const guestId = firstValue(params.guestId);
  const [roomTypes, guest] = await Promise.all([
    getReservationRoomTypes(),
    guestId ? getActiveGuestOption(guestId) : Promise.resolve(null),
  ]);

  const today = todayDateOnly();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New reservation</h1>
          <p className="text-muted-foreground">Book a guest into a room type for a set of dates.</p>
        </div>
      </div>

      {roomTypes.length === 0 ? (
        <Card className="mx-auto w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>No room types yet</CardTitle>
            <CardDescription>Create a room type before making reservations.</CardDescription>
            <Button asChild className="mx-auto mt-2">
              <Link href="/room-types">Go to room types</Link>
            </Button>
          </CardHeader>
        </Card>
      ) : (
        <ReservationForm
          mode="create"
          roomTypes={roomTypes}
          minCheckIn={toDateInputValue(today)}
          defaults={{
            guest,
            roomTypeId: "",
            checkIn: toDateInputValue(today),
            checkOut: toDateInputValue(tomorrow),
            roomId: "",
            adults: 1,
            children: 0,
            source: ReservationSource.WALK_IN,
            status: ReservationStatus.CONFIRMED,
          }}
        />
      )}
    </div>
  );
}
