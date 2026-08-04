"use client";

/**
 * Bowling Conditions Analysis -- Venue Comparison.
 *
 * "Where do I bowl well" -- the bowling-side mirror of
 * components/charts/venue-analysis.tsx: one horizontal bar per
 * venue, sized by overs bowled (volume), annotated with economy +
 * average (quality) so both dimensions are visible without a second
 * chart. Sorted by wickets taken so the venues that mattered most to
 * the current filter scope sit at the top. Complements, rather than
 * duplicates, the global `venue` filter (store/filters/types.ts) --
 * this is the across-all-venues spread a single-venue filter can't
 * show.
 */

import { useChartData } from "@/hooks/use-chart-data";

export interface VenueBowlingStat {
  venue_id: number;
  venue_name: string;
  city: string | null;
  overs: number;
  wickets: number;
  economy: number;
  average: number | null;
}

export interface VenueComparisonProps {
  path: string;
  title?: string;
}

export function VenueComparison({ path, title = "Venue Comparison" }: VenueComparisonProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<VenueBowlingStat[]>(path);

  const rows = data ? [...data].sort((a, b) => b.wickets - a.wickets).slice(0, 8) : [];
  const maxWickets = rows.length > 0 ? Math.max(...rows.map((r) => r.wickets), 1) : 1;

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
                  style={{ width: `${Math.max((v.wickets / maxWickets) * 100, 4)}%` }}
                  title={`${v.wickets} wickets at ${v.venue_name}`}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-fg-muted">{v.economy.toFixed(2)} econ</span>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-fg-muted">
                {v.average != null ? v.average.toFixed(1) : "--"} avg
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
