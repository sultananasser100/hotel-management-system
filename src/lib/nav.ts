import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BedDouble,
  Tag,
  Users,
  CalendarCheck,
  DoorOpen,
  CreditCard,
  Sparkles,
  UserCog,
  BarChart3,
  Bell,
  Settings,
} from "lucide-react";
import type { Resource } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  resource: Resource;
};

/**
 * The application's nav structure. Visibility is derived from can(role,
 * resource, "view") in src/lib/permissions.ts — there is no separate
 * role list here, so the two can't drift apart.
 */
export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, resource: "dashboard" },
  { title: "Rooms", href: "/rooms", icon: BedDouble, resource: "rooms" },
  { title: "Room Types", href: "/room-types", icon: Tag, resource: "roomTypes" },
  { title: "Guests", href: "/guests", icon: Users, resource: "guests" },
  { title: "Reservations", href: "/reservations", icon: CalendarCheck, resource: "reservations" },
  {
    title: "Check-in / Check-out",
    href: "/checkin-checkout",
    icon: DoorOpen,
    resource: "checkInOut",
  },
  { title: "Payments", href: "/payments", icon: CreditCard, resource: "payments" },
  { title: "Housekeeping", href: "/housekeeping", icon: Sparkles, resource: "housekeeping" },
  { title: "Staff", href: "/staff", icon: UserCog, resource: "staff" },
  { title: "Reports", href: "/reports", icon: BarChart3, resource: "reports" },
  { title: "Notifications", href: "/notifications", icon: Bell, resource: "notifications" },
  { title: "Settings", href: "/settings", icon: Settings, resource: "settings" },
];
