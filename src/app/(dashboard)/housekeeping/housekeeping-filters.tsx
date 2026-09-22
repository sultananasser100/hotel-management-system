"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { HousekeepingStatus } from "@/generated/prisma/enums";
import { HOUSEKEEPING_STATE_LABEL } from "@/lib/housekeeping-rules";
import type { Housekeeper } from "@/lib/housekeeping";
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

type HousekeepingFiltersProps = {
  initialQuery: string;
  initialStatus: string;
  initialFloor: string;
  initialAssignee: string;
  floors: number[];
  housekeepers: Housekeeper[];
};

export function HousekeepingFilters({
  initialQuery,
  initialStatus,
  initialFloor,
  initialAssignee,
  floors,
  housekeepers,
}: HousekeepingFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [floor, setFloor] = useState(initialFloor);
  const [assignee, setAssignee] = useState(initialAssignee);

  useEffect(() => {
    const trimmed = query.trim();
    if (
      trimmed === initialQuery &&
      status === initialStatus &&
      floor === initialFloor &&
      assignee === initialAssignee
    ) {
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (trimmed) params.set("q", trimmed);
      if (status) params.set("status", status);
      if (floor) params.set("floor", floor);
      if (assignee) params.set("assignee", assignee);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(timer);
  }, [
    query,
    status,
    floor,
    assignee,
    initialQuery,
    initialStatus,
    initialFloor,
    initialAssignee,
    pathname,
    router,
  ]);

  const hasFilters = Boolean(query || status || floor || assignee);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="relative w-full lg:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          aria-label="Search by room number"
          placeholder="Search room number"
          className="pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hk-status-filter" className="text-xs text-muted-foreground">
          Status
        </Label>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger id="hk-status-filter" className="w-full lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="attention">Needs attention</SelectItem>
            {Object.values(HousekeepingStatus).map((value) => (
              <SelectItem key={value} value={value}>
                {HOUSEKEEPING_STATE_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hk-floor-filter" className="text-xs text-muted-foreground">
          Floor
        </Label>
        <Select value={floor || "all"} onValueChange={(v) => setFloor(v === "all" ? "" : v)}>
          <SelectTrigger id="hk-floor-filter" className="w-full lg:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All floors</SelectItem>
            {floors.map((value) => (
              <SelectItem key={value} value={String(value)}>
                Floor {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hk-assignee-filter" className="text-xs text-muted-foreground">
          Assignee
        </Label>
        <Select
          value={assignee || "anyone"}
          onValueChange={(v) => setAssignee(v === "anyone" ? "" : v)}
        >
          <SelectTrigger id="hk-assignee-filter" className="w-full lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anyone">Anyone</SelectItem>
            <SelectItem value="me">Me</SelectItem>
            <SelectItem value="none">Unassigned</SelectItem>
            {housekeepers.map((housekeeper) => (
              <SelectItem key={housekeeper.id} value={housekeeper.id}>
                {housekeeper.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery("");
            setStatus("");
            setFloor("");
            setAssignee("");
          }}
        >
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
