"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DoorOpen, LogIn, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckInDialog } from "@/components/front-desk/check-in-dialog";
import { CheckOutDialog } from "@/components/front-desk/check-out-dialog";
import type { FrontDeskBoardItem } from "@/lib/front-desk";

type FrontDeskBoardProps = {
  arrivals: FrontDeskBoardItem[];
  pendingArrivals: FrontDeskBoardItem[];
  inHouse: FrontDeskBoardItem[];
  canManage: boolean;
};

type ActiveDialog = { kind: "in" | "out"; item: FrontDeskBoardItem } | null;

function EmptyState({ icon: Icon, message }: { icon: typeof DoorOpen; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
      <Icon className="size-5" />
      <span>{message}</span>
    </div>
  );
}

function RoomCell({ item }: { item: FrontDeskBoardItem }) {
  return (
    <div className="flex flex-col">
      <span>{item.roomTypeName}</span>
      <span className="text-xs text-muted-foreground">
        {item.roomNumber ? `Room ${item.roomNumber}` : "Unassigned"}
      </span>
    </div>
  );
}

function ReservationLink({ item }: { item: FrontDeskBoardItem }) {
  return (
    <Link href={`/reservations/${item.id}`} className="font-medium hover:underline">
      {item.confirmationCode}
    </Link>
  );
}

export function FrontDeskBoard({
  arrivals,
  pendingArrivals,
  inHouse,
  canManage,
}: FrontDeskBoardProps) {
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const closeDialog = useCallback(() => setDialog(null), []);

  return (
    <>
      <Tabs defaultValue="arrivals" className="gap-4">
        <TabsList>
          <TabsTrigger value="arrivals">Arrivals ({arrivals.length})</TabsTrigger>
          <TabsTrigger value="in-house">In-house ({inHouse.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="arrivals" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Due to arrive</CardTitle>
              <CardDescription>
                Confirmed reservations whose check-in date is today or earlier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {arrivals.length === 0 ? (
                <EmptyState icon={LogIn} message="No arrivals waiting to check in." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Confirmation</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Stay</TableHead>
                      <TableHead>Party</TableHead>
                      <TableHead className="text-center">Note</TableHead>
                      {canManage && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arrivals.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <ReservationLink item={item} />
                        </TableCell>
                        <TableCell>
                          <Link href={`/guests/${item.guestId}`} className="hover:underline">
                            {item.guestName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <RoomCell item={item} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>
                              {item.checkInLabel} → {item.checkOutLabel}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.nights} night{item.nights === 1 ? "" : "s"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{item.partyLabel}</TableCell>
                        <TableCell className="text-center">
                          {item.lateDays > 0 && (
                            <Badge variant="secondary">
                              Late ({item.lateDays} day{item.lateDays === 1 ? "" : "s"})
                            </Badge>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => setDialog({ kind: "in", item })}>
                              <LogIn className="size-4" />
                              Check in
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {pendingArrivals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Needs confirmation</CardTitle>
                <CardDescription>
                  Pending reservations due today. Confirm them before checking in.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {pendingArrivals.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2">
                      <span>
                        <ReservationLink item={item} />{" "}
                        <span className="text-muted-foreground">· {item.guestName}</span>
                      </span>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/reservations/${item.id}`}>Open</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="in-house">
          <Card>
            <CardHeader>
              <CardTitle>In-house guests</CardTitle>
              <CardDescription>Checked in, soonest departure first.</CardDescription>
            </CardHeader>
            <CardContent>
              {inHouse.length === 0 ? (
                <EmptyState icon={LogOut} message="No guests are checked in." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Confirmation</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Checked in</TableHead>
                      <TableHead>Departure</TableHead>
                      {canManage && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inHouse.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <ReservationLink item={item} />
                        </TableCell>
                        <TableCell>
                          <Link href={`/guests/${item.guestId}`} className="hover:underline">
                            {item.guestName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <RoomCell item={item} />
                        </TableCell>
                        <TableCell>{item.actualCheckInLabel ?? item.checkInLabel}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{item.checkOutLabel}</span>
                            {item.departsToday && <Badge>Departs today</Badge>}
                            {item.lateDays > 0 && (
                              <Badge variant="destructive">
                                Overdue ({item.lateDays} day{item.lateDays === 1 ? "" : "s"})
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDialog({ kind: "out", item })}
                            >
                              <LogOut className="size-4" />
                              Check out
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {dialog?.kind === "in" && (
        <CheckInDialog
          reservationId={dialog.item.id}
          confirmationCode={dialog.item.confirmationCode}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === "out" && (
        <CheckOutDialog
          reservationId={dialog.item.id}
          confirmationCode={dialog.item.confirmationCode}
          onClose={closeDialog}
        />
      )}
    </>
  );
}
