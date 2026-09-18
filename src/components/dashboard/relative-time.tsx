"use client";

import { useSyncExternalStore } from "react";

function formatRelative(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  return rtf.format(Math.round(diffHours / 24), "day");
}

function subscribe() {
  // Nothing external to subscribe to — this only needs to move from the
  // server snapshot to the client snapshot once, right after hydration.
  return () => {};
}

/**
 * Relative time ("5 minutes ago") depends on the current instant, which
 * differs between the server render and client hydration and would
 * otherwise cause a hydration mismatch. useSyncExternalStore renders the
 * server snapshot (null) through hydration, then switches to the real,
 * client-computed value — the supported way to defer a browser-only value
 * without calling setState in an effect (flagged by
 * react-hooks/set-state-in-effect, see src/hooks/use-mobile.ts).
 */
export function RelativeTime({ date }: { date: Date }) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatRelative(date),
    () => null,
  );

  return <span>{label ?? " "}</span>;
}
