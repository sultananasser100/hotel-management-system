import type { LucideIcon } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PlaceholderPageProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
};

/**
 * Shared body for nav sections that are scaffolded in the shell (Phase 4)
 * but implemented in a later phase. No feature logic lives here.
 */
export function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          {Icon && (
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
              <Icon className="size-5 text-muted-foreground" />
            </div>
          )}
          <CardTitle className="mt-2">{title}</CardTitle>
          <CardDescription>
            {description ?? "This section is coming in a later development phase."}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
