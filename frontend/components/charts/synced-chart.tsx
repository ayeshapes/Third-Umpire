"use client";

/**
 * Drop this on Dashboard/Players/Teams/Records/Analytics -- give it a
 * title and an endpoint path and it's fully wired to the shared
 * filter context via useChartData (hooks/use-chart-data.ts). No page
 * needs its own fetch/loading/error code.
 *
 * `memo`'d so a chart only re-renders for its *own* query result
 * changing, not because a sibling chart or an unrelated part of the
 * page re-rendered.
 *
 * Renders a plain inline-SVG bar chart on purpose -- this repo slice
 * didn't include a package.json, so we can't confirm a charting lib
 * (recharts/chart.js/etc) is already a dependency. Swap the render in
 * the "populated" branch below for your real chart lib; everything
 * above it (data fetching, loading/error/empty/dim-while-refetching)
 * stays the same either way.
 */

import { memo, useMemo } from "react";
import { useChartData } from "@/hooks/use-chart-data";

export interface ChartPoint {
  label: string;
  value: number;
}

interface SyncedChartProps {
  title: string;
  /** Chart endpoint, e.g. "/api/analytics/runs-by-season" -- see lib/api/charts.ts. */
  path: string;
}

function SyncedChartInner({ title, path }: SyncedChartProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<ChartPoint[]>(path);

  const bars = useMemo(() => {
    if (!data || data.length === 0) return [];
    const max = Math.max(...data.map((d) => d.value), 1);
    return data.map((d) => ({ ...d, pct: Math.max((d.value / max) * 100, 2) }));
  }, [data]);

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        // Loading state
        <div role="status" aria-label={`Loading ${title}`} className="flex h-40 items-end gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 animate-pulse rounded bg-surface-2"
              style={{ height: `${30 + (i % 3) * 20}%` }}
            />
          ))}
        </div>
      ) : isError ? (
        // Error state + retry
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load chart data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : bars.length === 0 ? (
        // Empty state
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">
          No data for the current filters
        </div>
      ) : (
        <div
          className={`flex h-40 items-end gap-2 transition-opacity duration-150 ${
            isFetching ? "opacity-50" : "opacity-100"
          }`}
        >
          {bars.map((bar) => (
            <div key={bar.label} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="w-full rounded-t bg-chart-1/70" style={{ height: `${bar.pct}%` }} />
              <span className="w-full truncate text-center text-[10px] text-fg-faint">{bar.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const SyncedChart = memo(SyncedChartInner);
