"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { ReservationStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reservationStatusLabel } from "@/components/dashboard/reservation-status-badge";

type ReservationFiltersProps = {
  initialQuery: string;
  initialStatus: string;
  initialFrom: string;
  initialTo: string;
};

export function ReservationFilters({
  initialQuery,
  initialStatus,
  initialFrom,
  initialTo,
}: ReservationFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  useEffect(() => {
    const trimmed = query.trim();
    if (
      trimmed === initialQuery &&
      status === initialStatus &&
      from === initialFrom &&
      to === initialTo
    ) {
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (trimmed) params.set("q", trimmed);
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(timer);
  }, [
    query,
    status,
    from,
    to,
    initialQuery,
    initialStatus,
    initialFrom,
    initialTo,
    pathname,
    router,
  ]);

  const hasFilters = Boolean(query || status || from || to);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="relative w-full lg:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          aria-label="Search reservations"
          placeholder="Search code, guest, or room"
          className="pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status-filter" className="text-xs text-muted-foreground">
          Status
        </Label>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger id="status-filter" className="w-full lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(ReservationStatus).map((value) => (
              <SelectItem key={value} value={value}>
                {reservationStatusLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from-filter" className="text-xs text-muted-foreground">
          Check-in from
        </Label>
        <Input
          id="from-filter"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="to-filter" className="text-xs text-muted-foreground">
          Check-in to
        </Label>
        <Input
          id="to-filter"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery("");
            setStatus("");
            setFrom("");
            setTo("");
          }}
        >
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
