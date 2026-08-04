"use client";

/**
 * Ticket 7.2 -- Boundary Timing.
 *
 * Wagon wheel's replacement: shot x/y was never in the schema (no
 * angle/distance column anywhere), so direction was never actually
 * recoverable from ball-by-ball data -- this answers the adjacent
 * question the data *does* support, "which overs do the boundaries
 * cluster in," as a per-over stacked bar (fours vs sixes), 1-20.
 * Same skyline shape as <ManhattanChart> since over-number-on-the-x-axis
 * is the right shape for both, and the same fours/sixes colour split
 * as <BoundaryAnalysis> (ivory fours, chart-1 sixes) for visual
 * consistency with the other boundary chart on this page.
 */

import { useChartData } from "@/hooks/use-chart-data";

export interface BoundaryTimingOver {
  over: number; // 1-indexed over number, 1-20
  fours: number;
  sixes: number;
}

export interface BoundaryTimingProps {
  path: string;
  title?: string;
}

export function BoundaryTiming({ path, title = "Boundary Timing" }: BoundaryTimingProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<BoundaryTimingOver[]>(path);

  const maxTotal = data && data.length > 0 ? Math.max(...data.map((d) => d.fours + d.sixes), 1) : 1;
  const totalFours = data ? data.reduce((sum, d) => sum + d.fours, 0) : 0;
  const totalSixes = data ? data.reduce((sum, d) => sum + d.sixes, 0) : 0;

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
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load boundary timing data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || totalFours + totalSixes === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-fg-faint">No boundary data for the current filters</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="flex h-48 items-end gap-1 overflow-x-auto">
            {data.map((o) => {
              const total = o.fours + o.sixes;
              const heightPct = Math.max((total / maxTotal) * 100, total > 0 ? 3 : 0);
              const fourShare = total > 0 ? o.fours / total : 0;
              return (
                <div key={o.over} className="flex min-w-[10px] flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="flex w-full flex-col justify-end overflow-hidden rounded-t"
                    style={{ height: `${heightPct}%` }}
                    title={`Over ${o.over}: ${o.fours} four${o.fours === 1 ? "" : "s"}, ${o.sixes} six${o.sixes === 1 ? "" : "s"}`}
                  >
                    <div className="w-full bg-chart-1" style={{ height: `${(1 - fourShare) * 100}%` }} />
                    <div className="w-full bg-ivory/60" style={{ height: `${fourShare * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-fg-faint">
            <span>Over {data[0]?.over}</span>
            <span>Over {data[data.length - 1]?.over}</span>
          </div>
          <div className="mt-3 flex justify-center gap-4 text-xs text-fg-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ivory/60" /> {totalFours} fours
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-chart-1" /> {totalSixes} sixes
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
