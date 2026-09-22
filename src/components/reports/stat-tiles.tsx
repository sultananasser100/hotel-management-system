import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Pre-formatted values (currency/percent/plain counts) — the same
// Card/CardHeader/CardContent tile anatomy as summary-cards.tsx and
// housekeeping-summary.tsx, generalized once here since Reports uses it
// across five sections.
type StatTile = { label: string; value: string };

export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map(({ label, value }) => (
        <Card key={label}>
          <CardHeader>
            <span className="text-sm text-muted-foreground">{label}</span>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold tracking-tight">{value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
