"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ReportFiltersProps = {
  initialFrom: string;
  initialTo: string;
};

export function ReportFilters({ initialFrom, initialTo }: ReportFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  useEffect(() => {
    if (from === initialFrom && to === initialTo) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(timer);
  }, [from, to, initialFrom, initialTo, pathname, router]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-from-filter" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="report-from-filter"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-to-filter" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="report-to-filter"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
    </div>
  );
}
