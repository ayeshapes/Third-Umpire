"use client";

/**
 * Ticket 8.2 -- Wicket Distribution.
 *
 * Which overs wickets actually fall in -- one bar per over, same
 * "skyline" shape as <ManhattanChart> but counting wickets instead of
 * runs, so the two read as a matched pair when placed side by side
 * (high-runs overs vs high-wicket overs often don't coincide, which
 * is exactly the thing this chart makes visible). Distinct from
 * <DismissalTypes>, which breaks wickets down by *how* (bowled/lbw/
 * caught/...) rather than *when*.
 */

import { useChartData } from "@/hooks/use-chart-data";

export interface WicketByOver {
  over: number; // 1-indexed over number
  wickets: number;
}

export interface WicketDistributionProps {
  path: string;
  title?: string;
}

export function WicketDistribution({ path, title = "Wicket Distribution" }: WicketDistributionProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<WicketByOver[]>(path);

  const maxWickets = data && data.length > 0 ? Math.max(...data.map((d) => d.wickets), 1) : 1;
  const totalWickets = data ? data.reduce((sum, d) => sum + d.wickets, 0) : 0;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex h-48 items-end gap-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="flex-1 animate-pulse rounded-t bg-surface-2" style={{ height: `${15 + (i % 5) * 12}%` }} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load wicket data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || totalWickets === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-fg-faint">No wicket data for the current filters</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="flex h-48 items-end gap-1 overflow-x-auto">
            {data.map((o) => (
              <div key={o.over} className="flex min-w-[10px] flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t bg-chart-1/70"
                  style={{ height: `${o.wickets > 0 ? Math.max((o.wickets / maxWickets) * 100, 6) : 1}%` }}
                  title={`Over ${o.over}: ${o.wickets} wicket${o.wickets === 1 ? "" : "s"}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-fg-faint">
            <span>Over {data[0]?.over}</span>
            <span>{totalWickets} wickets total</span>
            <span>Over {data[data.length - 1]?.over}</span>
          </div>
        </div>
      )}
    </div>
  );
}
