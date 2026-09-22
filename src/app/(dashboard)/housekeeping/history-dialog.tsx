"use client";

import { useEffect, useState } from "react";
import { PRIORITY_LABEL } from "@/lib/housekeeping-rules";
import { HOUSEKEEPING_TASK_STATUS_LABEL } from "@/lib/housekeeping-rules";
import type { RoomHousekeepingHistory } from "@/lib/housekeeping";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Result = { roomId: string; history: RoomHousekeepingHistory | null; error: string | null };

type HistoryDialogProps = {
  roomId: string;
  roomNumber: string;
  onClose: () => void;
};

// Mounted only while open, so it loads fresh data each time.
export function HistoryDialog({ roomId, roomNumber, onClose }: HistoryDialogProps) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/housekeeping/rooms/${roomId}/history`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Request failed");
        const history = (await res.json()) as RoomHousekeepingHistory;
        setResult({ roomId, history, error: null });
      } catch {
        if (!controller.signal.aborted) {
          setResult({
            roomId,
            history: null,
            error: "Couldn't load the history. Please try again.",
          });
        }
      }
    })();

    return () => controller.abort();
  }, [roomId]);

  const current = result?.roomId === roomId ? result : null;
  const history = current?.history ?? null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Room {roomNumber} housekeeping history</DialogTitle>
          <DialogDescription>Recent cleaning tasks and housekeeping activity.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1 text-sm">
          {!current && <p className="text-muted-foreground">Loading history...</p>}
          {current?.error && (
            <p role="alert" className="text-destructive">
              {current.error}
            </p>
          )}

          {history && (
            <>
              <section className="flex flex-col gap-2">
                <h3 className="font-medium">Cleaning tasks</h3>
                {history.tasks.length === 0 ? (
                  <p className="text-muted-foreground">No cleaning tasks yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {history.tasks.map((task) => (
                      <li key={task.id} className="flex flex-col gap-0.5 rounded-lg border p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">
                            {HOUSEKEEPING_TASK_STATUS_LABEL[task.status]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {PRIORITY_LABEL[task.priority]} priority
                          </span>
                        </div>
                        <span>
                          {task.assigneeName ? `Assigned to ${task.assigneeName}` : "Unassigned"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Created {task.createdLabel}
                          {task.completedLabel ? ` · Completed ${task.completedLabel}` : ""}
                        </span>
                        {task.notes && <span className="text-muted-foreground">{task.notes}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="font-medium">Activity</h3>
                {history.events.length === 0 ? (
                  <p className="text-muted-foreground">No housekeeping activity logged yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {history.events.map((event) => (
                      <li key={event.id} className="flex flex-col gap-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium">{event.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {event.timeLabel}
                          </span>
                        </div>
                        {event.detail && (
                          <span className="text-muted-foreground">{event.detail}</span>
                        )}
                        <span className="text-xs text-muted-foreground">by {event.actor}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
