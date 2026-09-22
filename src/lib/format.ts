const dateOnlyFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

// Date-only columns (@db.Date) are stored as UTC midnight, so they must be
// formatted in UTC — local formatting would show the previous day west of UTC.
export function formatDateOnly(date: Date): string {
  return dateOnlyFormat.format(date);
}

const timestampFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

// For real timestamps (e.g. actual check-in). Shown in UTC, matching the app's date handling.
export function formatTimestamp(date: Date): string {
  return timestampFormat.format(date);
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// A 0..1 ratio (e.g. 0.625) to a whole-percent label ("63%").
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
