"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BedDouble, MoreHorizontal, Plus, RotateCcw } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoomFormDialog } from "./room-form-dialog";
import { ROOM_STATUS_LABEL } from "./room-status";
import { deleteRoomAction, restoreRoomAction } from "@/lib/actions/rooms";
import type { RoomListItem, RoomTypeOption } from "@/lib/rooms";

export function RoomsTable({
  rooms,
  roomTypes,
  canManage,
}: {
  rooms: RoomListItem[];
  roomTypes: RoomTypeOption[];
  canManage: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>All rooms</CardTitle>
          <CardDescription>{rooms.length} rooms</CardDescription>
        </div>
        {canManage && (
          <CardAction>
            <Button size="sm" onClick={() => setCreateOpen(true)} disabled={roomTypes.length === 0}>
              <Plus className="size-4" />
              New room
            </Button>
            <RoomFormDialog roomTypes={roomTypes} open={createOpen} onOpenChange={setCreateOpen} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <BedDouble className="size-5" />
            <span>No rooms yet.</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead className="text-center">Floor</TableHead>
                <TableHead>Room type</TableHead>
                <TableHead className="text-center">Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <RoomRow key={room.id} room={room} roomTypes={roomTypes} canManage={canManage} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RoomRow({
  room,
  roomTypes,
  canManage,
}: {
  room: RoomListItem;
  roomTypes: RoomTypeOption[];
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRoomAction(room.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`Room ${room.roomNumber} deleted.`);
        setDeleteOpen(false);
      }
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreRoomAction(room.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`Room ${room.roomNumber} restored.`);
      }
    });
  }

  return (
    <TableRow className={room.isActive ? undefined : "text-muted-foreground"}>
      <TableCell className="font-medium">{room.roomNumber}</TableCell>
      <TableCell className="text-center">{room.floor}</TableCell>
      <TableCell>{room.roomType.name}</TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="outline">{ROOM_STATUS_LABEL[room.status]}</Badge>
          {!room.isActive && <Badge variant="secondary">Inactive</Badge>}
        </div>
      </TableCell>
      {canManage && (
        <TableCell className="text-right">
          {room.isActive ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <RoomFormDialog
                room={room}
                roomTypes={roomTypes}
                open={editOpen}
                onOpenChange={setEditOpen}
              />

              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete room {room.roomNumber}</DialogTitle>
                    <DialogDescription>
                      The room will be marked inactive and stay in the list, where it can be
                      restored later. Existing reservations and housekeeping history are kept.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={pending}
                      onClick={handleDelete}
                    >
                      {pending ? "Deleting..." : "Delete"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <Button variant="outline" size="sm" disabled={pending} onClick={handleRestore}>
              <RotateCcw className="size-4" />
              {pending ? "Restoring..." : "Restore"}
            </Button>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}
