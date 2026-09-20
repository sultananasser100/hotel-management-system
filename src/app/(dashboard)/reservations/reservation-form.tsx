"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { ReservationSource, ReservationStatus } from "@/generated/prisma/enums";
import {
  createReservationAction,
  updateReservationAction,
  type ReservationFormState,
} from "@/lib/actions/reservations";
import { INITIAL_STATUSES, SOURCE_LABEL } from "@/lib/reservation-constants";
import { calculateTotal, nightsBetween, parseDateOnly } from "@/lib/reservation-utils";
import { formatCurrency } from "@/lib/format";
import type { ReservationRoomType } from "@/lib/reservations";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import { reservationStatusLabel } from "@/components/dashboard/reservation-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: ReservationFormState = { status: "idle" };

type Availability = {
  nights: number;
  nightlyRate: number;
  total: number;
  bookableCount: number;
  availableCount: number;
  rooms: { id: string; roomNumber: string; floor: number }[];
};

type AvailabilityResult = { key: string; data: Availability | null; error: string | null };

export type ReservationFormDefaults = {
  guest: { id: string; name: string } | null;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  roomId: string;
  adults: number;
  children: number;
  source: ReservationSource;
  status: ReservationStatus;
  // Edit only: the stored total, kept when dates and room type are unchanged.
  totalAmount?: number;
};

type ReservationFormProps = {
  mode: "create" | "edit";
  reservationId?: string;
  roomTypes: ReservationRoomType[];
  minCheckIn: string;
  defaults: ReservationFormDefaults;
};

type GuestSearchResults = { query: string; options: ComboboxOption[]; failed: boolean };

function GuestPicker({
  value,
  label,
  onSelect,
}: {
  value: string;
  label: string;
  onSelect: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GuestSearchResults | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        try {
          const res = await fetch(`/api/guests/search?q=${encodeURIComponent(query)}`, {
            signal: controller.signal,
          });
          if (!res.ok) throw new Error("Request failed");
          const body = (await res.json()) as {
            guests: { id: string; name: string; detail: string | null }[];
          };
          setResults({
            query,
            failed: false,
            options: body.guests.map((g) => ({
              value: g.id,
              label: g.name,
              description: g.detail ?? undefined,
            })),
          });
        } catch {
          if (!controller.signal.aborted) setResults({ query, options: [], failed: true });
        }
      },
      query ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const loading = results?.query !== query;

  return (
    <Combobox
      id="guest"
      options={results?.options ?? []}
      value={value}
      selectedLabel={label || undefined}
      onValueChange={(id) => {
        const option = results?.options.find((o) => o.value === id);
        if (option) onSelect(id, option.label);
      }}
      onQueryChange={setQuery}
      loading={loading}
      placeholder="Select a guest"
      searchPlaceholder="Search name, email, or phone..."
      emptyText={results?.failed ? "Couldn't load guests." : "No matching active guests."}
    />
  );
}

export function ReservationForm({
  mode,
  reservationId,
  roomTypes,
  minCheckIn,
  defaults,
}: ReservationFormProps) {
  const isEdit = mode === "edit";
  const [state, formAction, pending] = useActionState(
    isEdit ? updateReservationAction : createReservationAction,
    initialState,
  );

  const [guest, setGuest] = useState(defaults.guest);
  const [roomTypeId, setRoomTypeId] = useState(defaults.roomTypeId);
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [roomId, setRoomId] = useState(defaults.roomId);
  const [adults, setAdults] = useState(String(defaults.adults));
  const [children, setChildren] = useState(String(defaults.children));
  const [source, setSource] = useState<string>(defaults.source);
  const [status, setStatus] = useState<string>(defaults.status);
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);

  const canQuery = Boolean(roomTypeId && checkIn && checkOut && checkOut > checkIn);
  const key = `${roomTypeId}|${checkIn}|${checkOut}`;

  useEffect(() => {
    if (!canQuery) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ roomTypeId, checkIn, checkOut });
        if (reservationId) params.set("excludeId", reservationId);
        const res = await fetch(`/api/reservations/availability?${params}`, {
          signal: controller.signal,
        });
        const body = await res.json();
        setAvailability({
          key,
          data: res.ok ? (body as Availability) : null,
          error: res.ok ? null : ((body.error as string) ?? "Couldn't check availability."),
        });
      } catch {
        if (!controller.signal.aborted) {
          setAvailability({ key, data: null, error: "Couldn't check availability." });
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canQuery, key, roomTypeId, checkIn, checkOut, reservationId]);

  const current = availability?.key === key ? availability : null;
  const checking = canQuery && !current;
  const freeRooms = current?.data?.rooms ?? [];
  // A picked room that the availability check shows is no longer free is dropped.
  // Until the check returns, keep the current value (the server validates it anyway).
  const effectiveRoomId = current?.data
    ? freeRooms.some((room) => room.id === roomId)
      ? roomId
      : ""
    : roomId;

  const selectedType = roomTypes.find((type) => type.id === roomTypeId);
  const checkInDate = parseDateOnly(checkIn);
  const checkOutDate = parseDateOnly(checkOut);
  const nights =
    checkInDate && checkOutDate && checkOutDate > checkInDate
      ? nightsBetween(checkInDate, checkOutDate)
      : 0;
  const unchanged =
    isEdit &&
    roomTypeId === defaults.roomTypeId &&
    checkIn === defaults.checkIn &&
    checkOut === defaults.checkOut;
  const total =
    unchanged && defaults.totalAmount !== undefined
      ? defaults.totalAmount
      : selectedType && nights > 0
        ? calculateTotal(nights, selectedType.basePrice)
        : null;

  const guestCount = (Number(adults) || 0) + (Number(children) || 0);
  const overOccupancy = selectedType ? guestCount > selectedType.maxOccupancy : false;
  const soldOut = current?.data ? current.data.availableCount < 1 : false;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {isEdit && <input type="hidden" name="id" value={reservationId} />}
      <input type="hidden" name="guestId" value={guest?.id ?? ""} />
      <input type="hidden" name="roomId" value={effectiveRoomId} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reservation details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guest">Guest</Label>
              <GuestPicker
                value={guest?.id ?? ""}
                label={guest?.name ?? ""}
                onSelect={(id, name) => setGuest({ id, name })}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="checkIn">Check-in</Label>
                <Input
                  id="checkIn"
                  name="checkIn"
                  type="date"
                  min={minCheckIn}
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="checkOut">Check-out</Label>
                <Input
                  id="checkOut"
                  name="checkOut"
                  type="date"
                  min={checkIn || minCheckIn}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="roomTypeId">Room type</Label>
              <Select name="roomTypeId" value={roomTypeId} onValueChange={setRoomTypeId} required>
                <SelectTrigger id="roomTypeId" className="w-full">
                  <SelectValue placeholder="Select a room type" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} — {formatCurrency(type.basePrice)}/night
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="roomSelect">Room (optional)</Label>
              <Select
                value={effectiveRoomId || "none"}
                onValueChange={(v) => setRoomId(v === "none" ? "" : v)}
                disabled={freeRooms.length === 0}
              >
                <SelectTrigger id="roomSelect" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Assign later</SelectItem>
                  {freeRooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      Room {room.roomNumber} (floor {room.floor})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose dates and a room type to see free rooms. A room can also be assigned later.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adults">Adults</Label>
                <Input
                  id="adults"
                  name="adults"
                  type="number"
                  min="1"
                  step="1"
                  value={adults}
                  onChange={(e) => setAdults(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="children">Children</Label>
                <Input
                  id="children"
                  name="children"
                  type="number"
                  min="0"
                  step="1"
                  value={children}
                  onChange={(e) => setChildren(e.target.value)}
                />
              </div>
            </div>
            {overOccupancy && selectedType && (
              <p className="text-sm text-destructive">
                {selectedType.name} allows at most {selectedType.maxOccupancy} guests.
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="source">Source</Label>
                <Select name="source" value={source} onValueChange={setSource}>
                  <SelectTrigger id="source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ReservationSource).map((value) => (
                      <SelectItem key={value} value={value}>
                        {SOURCE_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isEdit && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="status">Initial status</Label>
                  <Select name="status" value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INITIAL_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {reservationStatusLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Nights</dt>
                <dd>{nights > 0 ? nights : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rate per night</dt>
                <dd>{selectedType ? formatCurrency(selectedType.basePrice) : "—"}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd>{total !== null ? formatCurrency(total) : "—"}</dd>
              </div>
              {unchanged && (
                <p className="text-xs text-muted-foreground">
                  Dates and room type unchanged, so the stored total is kept.
                </p>
              )}
              <div className="border-t pt-3">
                {!canQuery ? (
                  <p className="text-muted-foreground">
                    Pick a room type and dates to check availability.
                  </p>
                ) : checking ? (
                  <p className="text-muted-foreground">Checking availability...</p>
                ) : current?.error ? (
                  <p className="text-destructive">{current.error}</p>
                ) : current?.data ? (
                  <p className={soldOut ? "text-destructive" : undefined}>
                    {soldOut
                      ? "No rooms of this type are available for these dates."
                      : `${current.data.availableCount} of ${current.data.bookableCount} rooms available.`}
                  </p>
                ) : null}
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || soldOut || !guest}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Create reservation"}
        </Button>
        <Button asChild variant="outline">
          <Link href={isEdit ? `/reservations/${reservationId}` : "/reservations"}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
