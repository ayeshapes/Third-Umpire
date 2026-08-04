"use client";

/**
 * Ticket 7.3 -- Match Conditions Analysis: Venue Analysis.
 *
 * "Where do I bat well" -- one horizontal bar per venue, sized by
 * innings played (volume), annotated with average + strike rate
 * (quality) so both dimensions are visible without needing a second
 * chart. Sorted by runs scored so the venues that matter most to the
 * current filter scope sit at the top. This intentionally does not
 * *filter* by venue (the global filter bar already offers a `venue`
 * filter for that, see store/filters/types.ts) -- it's the
 * across-all-venues breakdown a single-venue filter can't show.
 */

import { useChartData } from "@/hooks/use-chart-data";

export interface VenueBattingStat {
  venue_id: number;
  venue_name: string;
  city: string | null;
  innings: number;
  runs: number;
  average: number | null;
  strike_rate: number;
}

export interface VenueAnalysisProps {
  path: string;
  title?: string;
}

export function VenueAnalysis({ path, title = "Venue Analysis" }: VenueAnalysisProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<VenueBattingStat[]>(path);

  const rows = data ? [...data].sort((a, b) => b.runs - a.runs).slice(0, 8) : [];
  const maxRuns = rows.length > 0 ? Math.max(...rows.map((r) => r.runs), 1) : 1;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load venue data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-fg-faint">No venue data for the current filters</div>
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          {rows.map((v) => (
            <div key={v.venue_id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs text-fg-faint" title={v.venue_name}>
                {v.venue_name}
              </span>
              <div className="relative h-6 flex-1 overflow-hidden rounded bg-surface-2">
                <div
                  className="h-full rounded bg-chart-1/60"
                  style={{ width: `${Math.max((v.runs / maxRuns) * 100, 4)}%` }}
                  title={`${v.runs} runs at ${v.venue_name}`}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-fg-muted">
                {v.average != null ? v.average.toFixed(1) : "--"} avg
              </span>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-fg-muted">{v.strike_rate.toFixed(0)} SR</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
