"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "@/lib/actions/notifications";

export function MarkAllReadButton({ onDone }: { onDone?: () => void }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      onDone?.();
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleClick}>
      {pending ? "Marking..." : "Mark all as read"}
    </Button>
  );
}
