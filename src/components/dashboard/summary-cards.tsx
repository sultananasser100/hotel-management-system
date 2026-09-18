import type { LucideIcon } from "lucide-react";
import { BedDouble, DoorOpen, Sparkles, LogIn, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type StatTile = {
  label: string;
  value: number;
  icon: LucideIcon;
};

type SummaryCardsProps = {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  todaysArrivals: number;
  todaysDepartures: number;
};

export function SummaryCards({
  totalRooms,
  availableRooms,
  occupiedRooms,
  todaysArrivals,
  todaysDepartures,
}: SummaryCardsProps) {
  const tiles: StatTile[] = [
    { label: "Total rooms", value: totalRooms, icon: BedDouble },
    { label: "Available rooms", value: availableRooms, icon: DoorOpen },
    { label: "Occupied rooms", value: occupiedRooms, icon: Sparkles },
    { label: "Today's arrivals", value: todaysArrivals, icon: LogIn },
    { label: "Today's departures", value: todaysDepartures, icon: LogOut },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {tiles.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <Icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold tracking-tight">{value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
