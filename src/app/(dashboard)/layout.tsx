import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/session";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const cookieStore = await cookies();
  // Matches the cookie shadcn's sidebar itself writes on toggle, read here so
  // the server-rendered HTML already has the right expanded/collapsed state
  // instead of flashing open then snapping closed (or vice versa).
  const sidebarDefaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen}>
      <AppSidebar role={user.role} />
      <SidebarInset>
        <SiteHeader user={user} />
        <main className="flex flex-1 flex-col p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
