import { ReservationStatus } from "@/generated/prisma/enums";

export const DEFAULT_REPORT_RANGE_DAYS = 30;

// Above this many days in the selected range, bucket the time-series charts
// by week instead of by day so the bar chart stays readable.
export const WEEKLY_BUCKET_THRESHOLD_DAYS = 60;

// Which reservation statuses represent a stay that actually happened (or is
// happening), for occupancy and arrival/departure reporting. Deliberately a
// separate constant from OCCUPYING_STATUSES (reservation-constants.ts), which
// answers "does this still block a new booking" and excludes CHECKED_OUT —
// wrong here, since a historical report must count completed stays too.
export const REPORTABLE_OCCUPANCY_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKED_OUT,
];
