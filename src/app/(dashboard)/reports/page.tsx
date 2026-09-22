import { requirePermission } from "@/lib/session";
import { todayDateOnly } from "@/lib/dashboard";
import { parseDateOnly, toDateInputValue } from "@/lib/reservation-utils";
import { addDays } from "@/lib/report-utils";
import { DEFAULT_REPORT_RANGE_DAYS } from "@/lib/report-constants";
import {
  getGuestReport,
  getHousekeepingReport,
  getOccupancyReport,
  getReservationReport,
  getRevenueReport,
} from "@/lib/reports";
import { formatCurrency, formatPercent } from "@/lib/format";
import { ReportFilters } from "./report-filters";
import { StatTiles } from "@/components/reports/stat-tiles";
import { BarChart } from "@/components/reports/bar-chart";
import { RevenueByMethod } from "@/components/reports/revenue-by-method";
import { GuestNationality } from "@/components/reports/guest-nationality";
import {
  HousekeepingByPriority,
  HousekeepingByType,
} from "@/components/reports/housekeeping-breakdowns";
import { ReservationsByStatus } from "@/components/dashboard/reservations-by-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePermission("reports");
  const params = await searchParams;

  const today = todayDateOnly();
  const defaultFrom = addDays(today, -(DEFAULT_REPORT_RANGE_DAYS - 1));

  const parsedFrom = parseDateOnly(firstValue(params.from));
  const parsedTo = parseDateOnly(firstValue(params.to));
  const to = parsedTo ?? today;
  const from = parsedFrom && parsedFrom <= to ? parsedFrom : defaultFrom;

  const [revenue, occupancy, reservations, guests, housekeeping] = await Promise.all([
    getRevenueReport({ from, to }),
    getOccupancyReport({ from, to }),
    getReservationReport({ from, to }),
    getGuestReport({ from, to }),
    getHousekeepingReport({ from, to }),
  ]);

  const reservationsInRange = reservations.statusBreakdown.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Operational and financial summaries for the selected date range.
        </p>
      </div>

      <ReportFilters initialFrom={toDateInputValue(from)} initialTo={toDateInputValue(to)} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Revenue</h2>
        <StatTiles
          tiles={[
            { label: "Received", value: formatCurrency(revenue.receivedCents / 100) },
            { label: "Refunded / voided", value: formatCurrency(revenue.refundedCents / 100) },
            {
              label: "Outstanding balance (all time)",
              value: formatCurrency(revenue.outstandingCents / 100),
            },
          ]}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RevenueByMethod byMethod={revenue.byMethod} />
          <Card>
            <CardHeader>
              <CardTitle>Revenue over time</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
                data={revenue.trend.map((t) => ({ label: t.label, value: t.cents / 100 }))}
                formatValue={(v) => formatCurrency(v)}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Occupancy</h2>
        <StatTiles
          tiles={[
            { label: "Occupancy rate", value: formatPercent(occupancy.occupancyRate) },
            { label: "Occupied rooms (now)", value: String(occupancy.occupiedRoomsNow) },
            { label: "Available rooms (now)", value: String(occupancy.availableRoomsNow) },
          ]}
        />
        <div className="grid grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Occupancy over time</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
                data={occupancy.trend.map((t) => ({ label: t.label, value: t.rate }))}
                formatValue={(v) => formatPercent(v)}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Reservations</h2>
        <StatTiles
          tiles={[
            { label: "Arrivals in range", value: String(reservations.arrivals) },
            { label: "Departures in range", value: String(reservations.departures) },
          ]}
        />
        <ReservationsByStatus
          breakdown={reservations.statusBreakdown}
          description={`${reservationsInRange} reservations checking in during this range`}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Guests</h2>
        <StatTiles
          tiles={[
            { label: "Total guests (all time)", value: String(guests.totalGuests) },
            { label: "New in range", value: String(guests.newGuests) },
            { label: "Returning (all time)", value: String(guests.returningGuests) },
          ]}
        />
        <div className="grid grid-cols-1">
          <GuestNationality breakdown={guests.nationalityBreakdown} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Housekeeping</h2>
        <StatTiles
          tiles={[
            { label: "Completed (current status)", value: String(housekeeping.completed) },
            { label: "Open (current status)", value: String(housekeeping.open) },
          ]}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HousekeepingByType byType={housekeeping.byType} />
          <HousekeepingByPriority byPriority={housekeeping.byPriority} />
        </div>
      </section>
    </div>
  );
}
