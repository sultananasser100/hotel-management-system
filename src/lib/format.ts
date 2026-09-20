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

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
