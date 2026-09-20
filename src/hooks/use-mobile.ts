import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

// The server has no window, so it (and the first hydration render) uses
// `false`; useSyncExternalStore then switches to the real value right after
// hydration. Reading window in a useState initializer instead made the first
// client render differ from the server HTML on narrow screens (hydration mismatch).
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false);
}
