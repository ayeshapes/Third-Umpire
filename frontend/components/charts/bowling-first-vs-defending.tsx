"use client";

/**
 * Bowling Conditions Analysis -- Bowling First vs Defending.
 *
 * Mirrors components/charts/batting-order-comparison.tsx, viewed
 * from the bowling side of the same `battingOrder` filter (see
 * store/filters/types.ts): "Bowling First" is the innings a team
 * bowls having *not* batted yet ("chasing" from the batting-order
 * value's perspective -- they'll bat second); "Defending" is bowling
 * second after having batted first, protecting a total. Twin
 * horizontal bars per metric so the two conditions line up for a
 * direct visual comparison, same convention as the batting version.
 */

import { useChartData } from "@/hooks/use-chart-data";

export interface BowlingOrderSplitStat {
  overs: number;
  wickets: number;
  economy: number;
  average: number | null;
  win_percent: number;
}

export interface BowlingFirstVsDefendingData {
  bowling_first: BowlingOrderSplitStat;
  defending: BowlingOrderSplitStat;
}

export interface BowlingFirstVsDefendingProps {
  path: string;
  title?: string;
}

interface MetricRow {
  key: keyof BowlingOrderSplitStat;
  label: string;
  format: (v: number | null) => string;
  /** Smaller is better for economy/average -- flip which side "wins" visually is left to the reader, this just formats. */
}

const METRICS: MetricRow[] = [
  { key: "economy", label: "Economy", format: (v) => (v != null ? v.toFixed(2) : "--") },
  { key: "average", label: "Average", format: (v) => (v != null ? v.toFixed(1) : "--") },
  { key: "win_percent", label: "Win %", format: (v) => (v != null ? `${v.toFixed(0)}%` : "--") },
];

export function BowlingFirstVsDefending({ path, title = "Bowling First vs Defending" }: BowlingFirstVsDefendingProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<BowlingFirstVsDefendingData>(path);

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
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load bowling order data"}</span>
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
              <span className="h-2 w-2 rounded-full bg-ivory" /> Bowling First ({data.bowling_first.overs} ov)
            </span>
            <span className="flex items-center gap-1.5">
              Defending ({data.defending.overs} ov) <span className="h-2 w-2 rounded-full bg-chart-1" />
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {METRICS.map((m) => {
              const bf = data.bowling_first[m.key];
              const df = data.defending[m.key];
              const bfNum = typeof bf === "number" ? bf : 0;
              const dfNum = typeof df === "number" ? df : 0;
              const max = Math.max(bfNum, dfNum, 1);
              return (
                <div key={m.key}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-widest text-fg-faint">
                    <span>{m.format(bfNum)}</span>
                    <span>{m.label}</span>
                    <span>{m.format(dfNum)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex h-3 flex-1 justify-end overflow-hidden rounded-l-full bg-surface-2">
                      <div className="h-full rounded-l-full bg-ivory/60" style={{ width: `${(bfNum / max) * 100}%` }} />
                    </div>
                    <div className="flex h-3 flex-1 overflow-hidden rounded-r-full bg-surface-2">
                      <div className="h-full rounded-r-full bg-chart-1/60" style={{ width: `${(dfNum / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-center text-[10px] text-fg-faint">
            {data.bowling_first.wickets} wickets bowling first · {data.defending.wickets} wickets defending
          </p>
        </div>
      )}
    </div>
  );
}
