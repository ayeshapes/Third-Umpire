"use client";

/**
 * Ticket 8.2 -- Dismissal Types.
 *
 * How wickets fell -- bowled / caught / lbw / run out / stumped /
 * hit wicket -- as a horizontal bar-per-type breakdown ranked by
 * frequency. Distinct from <WicketDistribution>, which is about
 * *when* wickets fall (by over); this is purely about *how*, so a
 * player/team/season known for hitting the stumps vs. relying on
 * catches behind is visible at a glance.
 */

import { useChartData } from "@/hooks/use-chart-data";

// Rotating multi-color palette so each dismissal type reads as its own
// category rather than every bar defaulting to the same brand color.
const BAR_COLORS = [
  "bg-chart-1/70",
  "bg-chart-2/70",
  "bg-chart-3/70",
  "bg-chart-4/70",
  "bg-chart-5/70",
  "bg-chart-6/70",
];

export type DismissalType = "bowled" | "caught" | "lbw" | "run_out" | "stumped" | "hit_wicket" | "caught_and_bowled";

export interface DismissalTypeCount {
  type: DismissalType;
  count: number;
}

export interface DismissalTypesProps {
  path: string;
  title?: string;
}

const TYPE_LABEL: Record<DismissalType, string> = {
  bowled: "Bowled",
  caught: "Caught",
  lbw: "LBW",
  run_out: "Run Out",
  stumped: "Stumped",
  hit_wicket: "Hit Wicket",
  caught_and_bowled: "Caught & Bowled",
};

export function DismissalTypes({ path, title = "Dismissal Types" }: DismissalTypesProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<DismissalTypeCount[]>(path);

  const rows = data ? [...data].sort((a, b) => b.count - a.count) : [];
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const maxCount = rows.length > 0 ? Math.max(...rows.map((r) => r.count), 1) : 1;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-full animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load dismissal data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : rows.length === 0 || total === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-fg-faint">No dismissal data for the current filters</div>
      ) : (
        <div className={`flex flex-col gap-2.5 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          {rows.map((r, i) => (
            <div key={r.type} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-fg-faint">{TYPE_LABEL[r.type] ?? r.type}</span>
              <div className="relative h-5 flex-1 overflow-hidden rounded bg-surface-2">
                <div
                  className={`h-full rounded ${BAR_COLORS[i % BAR_COLORS.length]}`}
                  style={{ width: `${Math.max((r.count / maxCount) * 100, 4)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-fg-muted">
                {r.count} ({((r.count / total) * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
