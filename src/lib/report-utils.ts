import { formatDateOnly } from "@/lib/format";
import { WEEKLY_BUCKET_THRESHOLD_DAYS } from "@/lib/report-constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export type DateRange = { from: Date; to: Date };

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

// Inclusive day count between two UTC-midnight dates.
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
}

export type ReportBucket = { start: Date; end: Date; label: string };

// One bucket per day, or per week once the range is long enough that daily
// bars would be unreadable. `end` is inclusive.
export function buildDateBuckets(from: Date, to: Date): ReportBucket[] {
  const step = daysBetween(from, to) > WEEKLY_BUCKET_THRESHOLD_DAYS ? 7 : 1;

  const buckets: ReportBucket[] = [];
  for (let start = from; start <= to; start = addDays(start, step)) {
    const uncappedEnd = addDays(start, step - 1);
    const end = uncappedEnd > to ? to : uncappedEnd;
    buckets.push({
      start,
      end,
      label: step === 1 ? formatDateOnly(start) : `${formatDateOnly(start)}–${formatDateOnly(end)}`,
    });
  }
  return buckets;
}

// Room-nights a stay contributes within [rangeStart, rangeEndExclusive).
export function overlappingNights(
  checkIn: Date,
  checkOut: Date,
  rangeStart: Date,
  rangeEndExclusive: Date,
): number {
  const start = checkIn > rangeStart ? checkIn : rangeStart;
  const end = checkOut < rangeEndExclusive ? checkOut : rangeEndExclusive;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS));
}
