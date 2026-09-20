"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, RotateCcw, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { GuestFormDialog } from "./guest-form-dialog";
import { DeactivateGuestDialog } from "./deactivate-guest-dialog";
import { GuestSearch } from "./guest-search";
import { restoreGuestAction } from "@/lib/actions/guests";
import { GUESTS_PAGE_SIZE } from "@/lib/guest-constants";
import type { GuestListItem } from "@/lib/guests";

type GuestsTableProps = {
  guests: GuestListItem[];
  total: number;
  page: number;
  totalPages: number;
  query: string;
  canManage: boolean;
};

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/guests?${qs}` : "/guests";
}

export function GuestsTable({
  guests,
  total,
  page,
  totalPages,
  query,
  canManage,
}: GuestsTableProps) {
  const [createOpen, setCreateOpen] = useState(false);

  const from = total === 0 ? 0 : (page - 1) * GUESTS_PAGE_SIZE + 1;
  const to = Math.min(page * GUESTS_PAGE_SIZE, total);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>All guests</CardTitle>
            <CardDescription>
              {query ? `${total} matching "${query}"` : `${total} guests`}
            </CardDescription>
          </div>
          {canManage && (
            <>
              <Button size="sm" className="w-fit" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New guest
              </Button>
              <GuestFormDialog open={createOpen} onOpenChange={setCreateOpen} />
            </>
          )}
        </div>
        <GuestSearch initialQuery={query} />
      </CardHeader>
      <CardContent>
        {guests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Users className="size-5" />
            {query ? (
              <span>No guests match &quot;{query}&quot;.</span>
            ) : (
              <span>No guests yet.</span>
            )}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead className="text-center">Reservations</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map((guest) => (
                  <GuestRow key={guest.id} guest={guest} canManage={canManage} />
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                Showing {from}–{to} of {total}
              </span>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={pageHref(page - 1, query)}>
                      <ChevronLeft className="size-4" />
                      Previous
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                )}
                <span>
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={pageHref(page + 1, query)}>
                      Next
                      <ChevronRight className="size-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GuestRow({ guest, canManage }: { guest: GuestListItem; canManage: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const fullName = `${guest.firstName} ${guest.lastName}`;

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreGuestAction(guest.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${fullName} restored.`);
      }
    });
  }

  return (
    <TableRow className={guest.isActive ? undefined : "text-muted-foreground"}>
      <TableCell className="font-medium">
        <Link href={`/guests/${guest.id}`} className="hover:underline">
          {fullName}
        </Link>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>{guest.email ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{guest.phone ?? "—"}</span>
        </div>
      </TableCell>
      <TableCell>{guest.nationality ?? "—"}</TableCell>
      <TableCell className="text-center">{guest._count.reservations}</TableCell>
      <TableCell className="text-center">
        {guest.isActive ? (
          <Badge variant="outline">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        )}
      </TableCell>
      {canManage && (
        <TableCell className="text-right">
          {guest.isActive ? (
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

              <GuestFormDialog guest={guest} open={editOpen} onOpenChange={setEditOpen} />
              <DeactivateGuestDialog
                guestId={guest.id}
                guestName={fullName}
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
              />
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
