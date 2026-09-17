import { Role } from "@/generated/prisma/client";

/**
 * Role/permission matrix from the approved architecture plan (docs/ARCHITECTURE.md).
 * This is the single source of truth for "who can do what" — consulted both by
 * proxy.ts (optimistic route redirects, via ROLE_ONLY_ROUTE_PREFIXES) and by
 * server-side checks in Server Components/Actions/Route Handlers (the
 * authoritative check, via requireRole() in src/lib/session.ts).
 */
export type Resource =
  | "dashboard"
  | "rooms"
  | "roomTypes"
  | "guests"
  | "reservations"
  | "checkInOut"
  | "payments"
  | "housekeeping"
  | "staff"
  | "reports"
  | "notifications"
  | "settings";

export type Action = "view" | "manage";

const MATRIX: Record<Resource, Partial<Record<Role, Action[]>>> = {
  dashboard: { ADMIN: ["view"], RECEPTIONIST: ["view"], HOUSEKEEPING: ["view"] },
  rooms: { ADMIN: ["view", "manage"], RECEPTIONIST: ["view"], HOUSEKEEPING: ["view"] },
  roomTypes: { ADMIN: ["view", "manage"], RECEPTIONIST: ["view"] },
  guests: { ADMIN: ["view", "manage"], RECEPTIONIST: ["view", "manage"] },
  reservations: { ADMIN: ["view", "manage"], RECEPTIONIST: ["view", "manage"] },
  checkInOut: { ADMIN: ["view", "manage"], RECEPTIONIST: ["view", "manage"] },
  payments: { ADMIN: ["view", "manage"], RECEPTIONIST: ["view", "manage"] },
  housekeeping: {
    ADMIN: ["view", "manage"],
    RECEPTIONIST: ["view"],
    HOUSEKEEPING: ["view", "manage"],
  },
  staff: { ADMIN: ["view", "manage"] },
  reports: { ADMIN: ["view"], RECEPTIONIST: ["view"] },
  notifications: { ADMIN: ["view"], RECEPTIONIST: ["view"], HOUSEKEEPING: ["view"] },
  settings: { ADMIN: ["view", "manage"] },
};

export function can(role: Role, resource: Resource, action: Action = "view"): boolean {
  return MATRIX[resource]?.[role]?.includes(action) ?? false;
}

/** Route prefixes reserved for a single role, used for the proxy.ts optimistic redirect. */
export const ROLE_ONLY_ROUTE_PREFIXES: { prefix: string; role: Role }[] = [
  { prefix: "/staff", role: Role.ADMIN },
  { prefix: "/settings", role: Role.ADMIN },
];
