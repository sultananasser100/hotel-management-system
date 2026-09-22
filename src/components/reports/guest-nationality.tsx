import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type GuestNationalityProps = {
  breakdown: { nationality: string; count: number }[];
};

export function GuestNationality({ breakdown }: GuestNationalityProps) {
  const top = breakdown.slice(0, 10);
  const max = Math.max(1, ...top.map((b) => b.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guests by nationality</CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">No guests on record.</p>
        ) : (
          <ul className="space-y-3">
            {top.map(({ nationality, count }) => (
              <li key={nationality} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm">{nationality}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-medium">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
