const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Date-only columns are stored as UTC midnight (see prisma/seed.ts), so
// "YYYY-MM-DD" form values are parsed to exactly that.
export function parseDateOnly(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
}

export function calculateTotal(nights: number, nightlyRate: number): number {
  return Math.round(nights * nightlyRate * 100) / 100;
}
