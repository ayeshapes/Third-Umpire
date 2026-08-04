"use client";

/**
 * Ticket 7.2 -- Worm Graph.
 *
 * Cumulative-runs-by-over line chart comparing the two innings of a
 * match (or two teams' aggregate scoring pace across the current
 * filter scope) -- the shape of the line (where it pulls ahead/falls
 * behind) is the whole point, which a bar-per-over chart can't show
 * as legibly as a running line can.
 */

import { useMemo } from "react";
import { useChartData } from "@/hooks/use-chart-data";

export interface WormPoint {
  over: number;
  team1_cumulative: number;
  team2_cumulative: number;
}

export interface WormGraphData {
  team1_name: string;
  team2_name: string;
  points: WormPoint[];
}

export interface WormGraphProps {
  path: string;
  title?: string;
}

const WIDTH = 560;
const HEIGHT = 220;
const PAD_LEFT = 34;
const PAD_BOTTOM = 22;
const PAD_TOP = 10;
const PAD_RIGHT = 10;

export function WormGraph({ path, title = "Worm Graph" }: WormGraphProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<WormGraphData>(path);

  const geometry = useMemo(() => {
    if (!data || data.points.length === 0) return null;
    const maxOver = Math.max(...data.points.map((p) => p.over), 1);
    const maxRuns = Math.max(...data.points.map((p) => Math.max(p.team1_cumulative, p.team2_cumulative)), 1);

    const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const x = (over: number) => PAD_LEFT + (over / maxOver) * plotW;
    const y = (runs: number) => PAD_TOP + plotH - (runs / maxRuns) * plotH;

    const line1 = data.points.map((p) => `${x(p.over)},${y(p.team1_cumulative)}`).join(" ");
    const line2 = data.points.map((p) => `${x(p.over)},${y(p.team2_cumulative)}`).join(" ");

    return { maxOver, maxRuns, x, y, line1, line2 };
  }, [data]);

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="h-56 w-full animate-pulse rounded-lg bg-surface-2" />
      ) : isError ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load worm data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || !geometry ? (
        <div className="flex h-56 items-center justify-center text-xs text-fg-faint">No innings data for the current filters</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`${title}: ${data.team1_name} vs ${data.team2_name}`}>
            {/* Gridlines */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line
                key={f}
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) * (1 - f)}
                y2={PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) * (1 - f)}
                className="text-line-strong"
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray="2 4"
              />
            ))}
            <text x={4} y={PAD_TOP + 4} className="fill-fg-faint text-[9px]">
              {geometry.maxRuns}
            </text>
            <text x={4} y={HEIGHT - PAD_BOTTOM} className="fill-fg-faint text-[9px]">
              0
            </text>

            <polyline points={geometry.line1} fill="none" className="text-chart-1" stroke="currentColor" strokeWidth={2} />
            <polyline points={geometry.line2} fill="none" className="text-chart-2" stroke="currentColor" strokeWidth={2} />

            <line x1={PAD_LEFT} y1={HEIGHT - PAD_BOTTOM} x2={WIDTH - PAD_RIGHT} y2={HEIGHT - PAD_BOTTOM} className="text-line-strong" stroke="currentColor" strokeWidth={1} />
          </svg>

          <div className="mt-2 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-fg-faint">
              <span className="h-2 w-2 rounded-full bg-chart-1" /> {data.team1_name}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-fg-faint">
              <span className="bg-chart-2 h-2 w-2 rounded-full" /> {data.team2_name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
