"use client";

/**
 * Ticket 7.2 -- Partnership Analysis.
 *
 * One horizontal bar per wicket partnership (1st wicket, 2nd wicket,
 * ...), sized by runs added and labelled with both batters -- reads
 * as a partnership-by-partnership breakdown of an innings the way a
 * scorecard shows it, rather than as an undifferentiated bar chart:
 * each bar's *label* (the pair of names) carries as much information
 * as its length does.
 */

import { useChartData } from "@/hooks/use-chart-data";

export interface PartnershipRow {
  wicket: number; // 1 = 1st wicket partnership, etc.
  batter1: string;
  batter2: string;
  runs: number;
  balls: number;
}

export interface PartnershipAnalysisProps {
  path: string;
  title?: string;
}

export function PartnershipAnalysis({ path, title = "Partnership Analysis" }: PartnershipAnalysisProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<PartnershipRow[]>(path);

  const maxRuns = data && data.length > 0 ? Math.max(...data.map((p) => p.runs), 1) : 1;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load partnership data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No partnership data for the current filters</div>
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          {data.map((p) => (
            <div key={p.wicket} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-xs font-medium text-fg-faint">{ordinal(p.wicket)}</span>
              <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-surface-2">
                <div
                  className="flex h-full items-center rounded-lg bg-chart-1/60 px-3"
                  style={{ width: `${Math.max((p.runs / maxRuns) * 100, 12)}%` }}
                >
                  <span className="truncate text-xs font-medium text-ivory">
                    {p.batter1} &amp; {p.batter2}
                  </span>
                </div>
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-fg-muted">
                {p.runs} ({p.balls})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
