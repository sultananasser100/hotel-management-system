"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Tag } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { RoomTypeFormDialog } from "./room-type-form-dialog";
import { deleteRoomTypeAction } from "@/lib/actions/room-types";
import type { RoomTypeListItem } from "@/lib/room-types";

export function RoomTypesTable({
  roomTypes,
  canManage,
}: {
  roomTypes: RoomTypeListItem[];
  canManage: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>All room types</CardTitle>
          <CardDescription>{roomTypes.length} room types</CardDescription>
        </div>
        {canManage && (
          <CardAction>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New room type
            </Button>
            <RoomTypeFormDialog open={createOpen} onOpenChange={setCreateOpen} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {roomTypes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Tag className="size-5" />
            <span>No room types yet.</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Max occupancy</TableHead>
                <TableHead className="text-center">Base price</TableHead>
                <TableHead className="text-center">Rooms</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomTypes.map((roomType) => (
                <RoomTypeRow key={roomType.id} roomType={roomType} canManage={canManage} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RoomTypeRow({ roomType, canManage }: { roomType: RoomTypeListItem; canManage: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const roomCount = roomType._count.rooms;

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRoomTypeAction(roomType.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Room type deleted.");
        setDeleteOpen(false);
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{roomType.name}</TableCell>
      <TableCell className="max-w-xs truncate text-muted-foreground">
        {roomType.description || "—"}
      </TableCell>
      <TableCell className="text-center">{roomType.maxOccupancy}</TableCell>
      <TableCell className="text-center">${roomType.basePrice.toFixed(2)}</TableCell>
      <TableCell className="text-center">{roomCount}</TableCell>
      {canManage && (
        <TableCell className="text-right">
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

          <RoomTypeFormDialog roomType={roomType} open={editOpen} onOpenChange={setEditOpen} />

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete room type</DialogTitle>
                <DialogDescription>
                  {roomCount > 0
                    ? `This room type is used by ${roomCount} room${roomCount === 1 ? "" : "s"} and can't be deleted until they're reassigned or removed.`
                    : `Are you sure you want to delete "${roomType.name}"? This can't be undone.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                {roomCount === 0 && (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pending}
                    onClick={handleDelete}
                  >
                    {pending ? "Deleting..." : "Delete"}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TableCell>
      )}
    </TableRow>
  );
}
