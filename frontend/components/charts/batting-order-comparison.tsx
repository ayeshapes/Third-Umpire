"use client";

/**
 * Ticket 7.3 -- Match Conditions Analysis: Chasing vs Batting First.
 *
 * Mirrors the `battingOrder` filter's two values ("batting_first" /
 * "chasing", see store/filters/types.ts) as a direct head-to-head
 * comparison instead of requiring the user to flip the filter back
 * and forth and remember the previous numbers. Twin horizontal bars
 * per metric (one pair per row) so the two conditions line up for
 * easy visual comparison at a glance.
 */

import { useChartData } from "@/hooks/use-chart-data";

export interface BattingOrderSplitStat {
  innings: number;
  runs: number;
  average: number | null;
  strike_rate: number;
  win_percent: number;
}

export interface BattingOrderComparisonData {
  batting_first: BattingOrderSplitStat;
  chasing: BattingOrderSplitStat;
}

export interface BattingOrderComparisonProps {
  path: string;
  title?: string;
}

interface MetricRow {
  key: keyof BattingOrderSplitStat;
  label: string;
  format: (v: number | null) => string;
}

const METRICS: MetricRow[] = [
  { key: "average", label: "Average", format: (v) => (v != null ? v.toFixed(1) : "--") },
  { key: "strike_rate", label: "Strike Rate", format: (v) => (v != null ? v.toFixed(1) : "--") },
  { key: "win_percent", label: "Win %", format: (v) => (v != null ? `${v.toFixed(0)}%` : "--") },
];

export function BattingOrderComparison({ path, title = "Chasing vs Batting First" }: BattingOrderComparisonProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<BattingOrderComparisonData>(path);

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load batting order data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No data for the current filters</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="mb-4 flex items-center justify-between text-xs text-fg-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ivory" /> Batting First ({data.batting_first.innings} inn)
            </span>
            <span className="flex items-center gap-1.5">
              Chasing ({data.chasing.innings} inn) <span className="h-2 w-2 rounded-full bg-chart-1" />
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {METRICS.map((m) => {
              const bf = data.batting_first[m.key];
              const ch = data.chasing[m.key];
              const bfNum = typeof bf === "number" ? bf : 0;
              const chNum = typeof ch === "number" ? ch : 0;
              const max = Math.max(bfNum, chNum, 1);
              return (
                <div key={m.key}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-fg-faint">
                    <span>{m.format(bfNum)}</span>
                    <span>{m.label}</span>
                    <span>{m.format(chNum)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex h-3 flex-1 justify-end overflow-hidden rounded-l-full bg-surface-2">
                      <div className="h-full rounded-l-full bg-ivory/60" style={{ width: `${(bfNum / max) * 100}%` }} />
                    </div>
                    <div className="flex h-3 flex-1 overflow-hidden rounded-r-full bg-surface-2">
                      <div className="h-full rounded-r-full bg-chart-1/60" style={{ width: `${(chNum / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
