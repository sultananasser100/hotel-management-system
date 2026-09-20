"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/payment-constants";
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

type PaymentFiltersProps = {
  initialQuery: string;
  initialStatus: string;
  initialMethod: string;
  initialFrom: string;
  initialTo: string;
};

export function PaymentFilters({
  initialQuery,
  initialStatus,
  initialMethod,
  initialFrom,
  initialTo,
}: PaymentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [method, setMethod] = useState(initialMethod);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  useEffect(() => {
    const trimmed = query.trim();
    if (
      trimmed === initialQuery &&
      status === initialStatus &&
      method === initialMethod &&
      from === initialFrom &&
      to === initialTo
    ) {
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (trimmed) params.set("q", trimmed);
      if (status) params.set("status", status);
      if (method) params.set("method", method);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(timer);
  }, [
    query,
    status,
    method,
    from,
    to,
    initialQuery,
    initialStatus,
    initialMethod,
    initialFrom,
    initialTo,
    pathname,
    router,
  ]);

  const hasFilters = Boolean(query || status || method || from || to);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="relative w-full lg:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          aria-label="Search payments"
          placeholder="Search confirmation code or guest"
          className="pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payment-status-filter" className="text-xs text-muted-foreground">
          Status
        </Label>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger id="payment-status-filter" className="w-full lg:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(PaymentStatus).map((value) => (
              <SelectItem key={value} value={value}>
                {PAYMENT_STATUS_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payment-method-filter" className="text-xs text-muted-foreground">
          Method
        </Label>
        <Select value={method || "all"} onValueChange={(v) => setMethod(v === "all" ? "" : v)}>
          <SelectTrigger id="payment-method-filter" className="w-full lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {Object.values(PaymentMethod).map((value) => (
              <SelectItem key={value} value={value}>
                {PAYMENT_METHOD_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payment-from-filter" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="payment-from-filter"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payment-to-filter" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="payment-to-filter"
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
            setMethod("");
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
