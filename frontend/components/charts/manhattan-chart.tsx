"use client";

/**
 * Ticket 7.2 -- Manhattan Chart.
 *
 * Runs-per-over bars (the "Manhattan skyline" cricket broadcasters
 * use) with a wicket marker stacked above any over a wicket fell in.
 * A plain bar chart already existed on this page (<SyncedChart>) --
 * what makes this a *Manhattan* chart specifically, not a repeat of
 * that, is the per-over x-axis plus the wicket overlay; without the
 * wicket markers this is just "runs by over," a materially different
 * (and less useful) chart.
 */

import { useChartData } from "@/hooks/use-chart-data";

export interface ManhattanOver {
  over: number; // 1-indexed over number
  runs: number;
  wickets: number;
}

export interface ManhattanChartProps {
  path: string;
  title?: string;
}

export function ManhattanChart({ path, title = "Manhattan Chart" }: ManhattanChartProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<ManhattanOver[]>(path);

  const maxRuns = data && data.length > 0 ? Math.max(...data.map((d) => d.runs), 1) : 1;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex h-48 items-end gap-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="flex-1 animate-pulse rounded-t bg-surface-2" style={{ height: `${20 + (i % 4) * 15}%` }} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load over data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-fg-faint">No over data for the current filters</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="flex h-48 items-end gap-1 overflow-x-auto">
            {data.map((o) => (
              <div key={o.over} className="flex min-w-[10px] flex-1 flex-col items-center justify-end gap-1">
                {o.wickets > 0 && (
                  <span className="flex gap-0.5" title={`${o.wickets} wicket${o.wickets === 1 ? "" : "s"} in over ${o.over}`}>
                    {Array.from({ length: o.wickets }).map((_, w) => (
                      <span key={w} className="block h-1.5 w-1.5 rounded-full bg-chart-1" />
                    ))}
                  </span>
                )}
                <div
                  className="w-full rounded-t bg-chart-1/60"
                  style={{ height: `${Math.max((o.runs / maxRuns) * 100, 3)}%` }}
                  title={`Over ${o.over}: ${o.runs} run${o.runs === 1 ? "" : "s"}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-fg-faint">
            <span>Over {data[0]?.over}</span>
            <span>Over {data[data.length - 1]?.over}</span>
          </div>
        </div>
      )}
    </div>
  );
}
