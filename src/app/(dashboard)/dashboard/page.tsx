import { requireUser } from "@/lib/session";
import { getDashboardData } from "@/lib/dashboard";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { OccupancyOverview } from "@/components/dashboard/occupancy-overview";
import { ReservationsByStatus } from "@/components/dashboard/reservations-by-status";
import { ArrivalsList } from "@/components/dashboard/arrivals-list";
import { DeparturesList } from "@/components/dashboard/departures-list";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user.name}</h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening at the hotel today.
        </p>
      </div>

      <SummaryCards
        totalRooms={data.totalRooms}
        availableRooms={data.availableRooms}
        occupiedRooms={data.occupiedRooms}
        todaysArrivals={data.todaysArrivals.length}
        todaysDepartures={data.todaysDepartures.length}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OccupancyOverview breakdown={data.roomStatusBreakdown} />
        <ReservationsByStatus breakdown={data.reservationStatusBreakdown} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ArrivalsList arrivals={data.todaysArrivals} />
        <DeparturesList departures={data.todaysDepartures} />
      </div>

      <RecentActivity entries={data.recentActivity} />
    </div>
  );
}
