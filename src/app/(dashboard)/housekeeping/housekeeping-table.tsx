import { Sparkles } from "lucide-react";
import { HousekeepingTaskPriority } from "@/generated/prisma/enums";
import { HOUSEKEEPING_PAGE_SIZE, PRIORITY_LABEL } from "@/lib/housekeeping-rules";
import type { Housekeeper, HousekeepingRow } from "@/lib/housekeeping";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";
import { HousekeepingStatusBadge } from "@/components/housekeeping/housekeeping-status-badge";
import { ROOM_STATUS_LABEL } from "@/app/(dashboard)/rooms/room-status";
import { HousekeepingFilters } from "./housekeeping-filters";
import { HousekeepingRowActions } from "./housekeeping-row-actions";

type HousekeepingTableProps = {
  rooms: HousekeepingRow[];
  total: number;
  page: number;
  totalPages: number;
  filters: { q: string; status: string; floor: string; assignee: string };
  floors: number[];
  housekeepers: Housekeeper[];
  canManage: boolean;
  isAdmin: boolean;
  currentUserId: string;
};

function PriorityCell({ task }: { task: HousekeepingRow["task"] }) {
  if (!task) return <span className="text-muted-foreground">—</span>;
  if (task.priority === HousekeepingTaskPriority.URGENT) {
    return <Badge variant="destructive">{PRIORITY_LABEL[task.priority]}</Badge>;
  }
  if (task.priority === HousekeepingTaskPriority.HIGH) {
    return <Badge>{PRIORITY_LABEL[task.priority]}</Badge>;
  }
  return <span className="text-muted-foreground">{PRIORITY_LABEL[task.priority]}</span>;
}

export function HousekeepingTable({
  rooms,
  total,
  page,
  totalPages,
  filters,
  floors,
  housekeepers,
  canManage,
  isAdmin,
  currentUserId,
}: HousekeepingTableProps) {
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div>
          <CardTitle>Rooms</CardTitle>
          <CardDescription>
            {hasFilters ? `${total} matching your filters` : `${total} active rooms`}
          </CardDescription>
        </div>
        <HousekeepingFilters
          initialQuery={filters.q}
          initialStatus={filters.status}
          initialFloor={filters.floor}
          initialAssignee={filters.assignee}
          floors={floors}
          housekeepers={housekeepers}
        />
      </CardHeader>
      <CardContent>
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Sparkles className="size-5" />
            <span>{hasFilters ? "No rooms match your filters." : "No active rooms yet."}</span>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Housekeeping</TableHead>
                  <TableHead className="text-center">Room status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead className="text-center">Priority</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          Room {room.roomNumber}{" "}
                          <span className="font-normal text-muted-foreground">
                            · Floor {room.floor}
                          </span>
                        </span>
                        {(room.inHouse || room.arrivingToday || room.departsToday) && (
                          <div className="flex flex-wrap gap-1">
                            {room.inHouse && <Badge variant="secondary">In-house</Badge>}
                            {room.departsToday && <Badge variant="outline">Departs today</Badge>}
                            {room.arrivingToday && <Badge variant="outline">Arriving today</Badge>}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{room.roomTypeName}</TableCell>
                    <TableCell className="text-center">
                      <HousekeepingStatusBadge status={room.housekeepingStatus} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{ROOM_STATUS_LABEL[room.roomStatus]}</Badge>
                    </TableCell>
                    <TableCell>{room.task?.assigneeName ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <PriorityCell task={room.task} />
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {room.task?.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{room.updatedLabel}</TableCell>
                    <TableCell className="text-right">
                      <HousekeepingRowActions
                        room={room}
                        canManage={canManage}
                        isAdmin={isAdmin}
                        currentUserId={currentUserId}
                        housekeepers={housekeepers}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <PaginationBar
              basePath="/housekeeping"
              params={filters}
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={HOUSEKEEPING_PAGE_SIZE}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
