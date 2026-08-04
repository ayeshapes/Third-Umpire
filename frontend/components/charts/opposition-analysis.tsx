"use client";

/**
 * Ticket 7.3 -- Match Conditions Analysis: Opposition Analysis.
 *
 * Same bar-per-category shape as <VenueAnalysis>, grouped by opponent
 * team instead of venue -- "who do I dominate / struggle against".
 * Kept as a separate component (rather than a `groupBy` prop on one
 * shared chart) because the two answer different questions and may
 * grow different annotations over time (e.g. head-to-head record
 * here vs. pitch characteristics on venue).
 */

import { useChartData } from "@/hooks/use-chart-data";

export interface OppositionBattingStat {
  opponent_code: string;
  opponent_name: string;
  innings: number;
  runs: number;
  average: number | null;
  strike_rate: number;
  dismissals: number;
}

export interface OppositionAnalysisProps {
  path: string;
  title?: string;
}

export function OppositionAnalysis({ path, title = "Opposition Analysis" }: OppositionAnalysisProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<OppositionBattingStat[]>(path);

  const rows = data ? [...data].sort((a, b) => b.runs - a.runs) : [];
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
          <span className="text-center">
            {error instanceof Error ? error.message : "Failed to load opposition data"}
          </span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-fg-faint">
          No opposition data for the current filters
        </div>
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          {rows.map((o) => (
            <div key={o.opponent_code} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs font-medium text-fg-faint">{o.opponent_code}</span>
              <div className="relative h-6 flex-1 overflow-hidden rounded bg-surface-2">
                <div
                  className="h-full rounded bg-ivory/50"
                  style={{ width: `${Math.max((o.runs / maxRuns) * 100, 4)}%` }}
                  title={`${o.runs} runs vs ${o.opponent_name}`}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-fg-muted">
                {o.average != null ? o.average.toFixed(1) : "--"} avg
              </span>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-fg-muted">{o.strike_rate.toFixed(0)} SR</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
