"use client";

import { useEffect, useState } from "react";
import type { FrontDeskInfo } from "@/lib/front-desk";

type Result = { id: string; info: FrontDeskInfo | null; error: string | null };

export function useFrontDeskInfo(reservationId: string) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/reservations/${reservationId}/front-desk-info`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Request failed");
        const info = (await res.json()) as FrontDeskInfo;
        setResult({ id: reservationId, info, error: null });
      } catch {
        if (!controller.signal.aborted) {
          setResult({
            id: reservationId,
            info: null,
            error: "Couldn't load the reservation details. Please try again.",
          });
        }
      }
    })();

    return () => controller.abort();
  }, [reservationId]);

  const current = result?.id === reservationId ? result : null;
  return { info: current?.info ?? null, error: current?.error ?? null, loading: current === null };
}
