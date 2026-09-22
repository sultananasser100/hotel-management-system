// A small vertical bar chart built with plain Tailwind divs, matching the
// rest of the app (no charting library is installed anywhere) — the same
// technique as occupancy-overview.tsx's stacked bar, just oriented for a
// time series instead of a single-moment breakdown.
type BarChartProps = {
  data: { label: string; value: number }[];
  formatValue?: (value: number) => string;
};

export function BarChart({ data, formatValue = (value) => String(value) }: BarChartProps) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="text-sm text-muted-foreground">No data for this range.</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.value));

  // Each bar is a flex-1 column, but a flex item's default min-width is its
  // own content's natural width — with 30+ daily buckets and date labels
  // like "Sep 22, 2026", that content-driven minimum is far wider than any
  // viewport, and (being a flex/grid item all the way up) pushes the whole
  // page into horizontal overflow rather than just this chart. Explicit
  // min-w-10 replaces that auto content-based minimum so bars can actually
  // shrink and their labels can truncate; overflow-x-auto (same pattern as
  // ui/table.tsx's table-container) contains any remaining width within the
  // chart itself instead of the page, and gives many-bucket ranges (e.g. a
  // 2-year view bucketed weekly) a scrollable chart instead of unreadable
  // hairline bars.
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex h-40 items-end gap-1">
        {data.map((d, index) => (
          <div
            key={`${d.label}-${index}`}
            className="flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-1"
            title={`${d.label}: ${formatValue(d.value)}`}
          >
            <div
              className="w-full rounded-t-sm bg-primary"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
            />
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
