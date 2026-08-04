"use client";

/**
 * Ticket 9.2 -- Run Rate Comparison.
 *
 * Per-over run rate (runs that over x6, not cumulative) for both
 * innings on the same axis, plus the chasing team's required run
 * rate where applicable -- distinct from <WormGraph> (cumulative
 * total, so it can only show *who's ahead*) and <ManhattanChart>
 * (single-innings runs-per-over with wickets): this is the only chart
 * on the page that puts scoring *pace* for both innings side by side,
 * which is what "was this over quick or slow, relative to the other
 * innings and to what's required" actually needs.
 */

import { useMemo } from "react";
import { useChartData } from "@/hooks/use-chart-data";

export interface RunRatePoint {
  over: number; // 1-indexed
  team1_rate: number;
  team2_rate: number | null; // null for overs not yet reached in a live/partial 2nd innings
  required_rate: number | null; // only meaningful during the chase (2nd innings)
}

export interface RunRateComparisonData {
  team1_name: string;
  team2_name: string;
  points: RunRatePoint[];
}

export interface RunRateComparisonProps {
  path: string;
  title?: string;
}

const WIDTH = 560;
const HEIGHT = 220;
const PAD_LEFT = 30;
const PAD_BOTTOM = 22;
const PAD_TOP = 10;
const PAD_RIGHT = 10;

export function RunRateComparison({ path, title = "Run Rate Comparison" }: RunRateComparisonProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<RunRateComparisonData>(path);

  const geometry = useMemo(() => {
    if (!data || data.points.length === 0) return null;
    const maxOver = Math.max(...data.points.map((p) => p.over), 1);
    const maxRate = Math.max(
      ...data.points.map((p) => Math.max(p.team1_rate, p.team2_rate ?? 0, p.required_rate ?? 0)),
      6
    );

    const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const x = (over: number) => PAD_LEFT + (over / maxOver) * plotW;
    const y = (rate: number) => PAD_TOP + plotH - (rate / maxRate) * plotH;

    const line1 = data.points.map((p) => `${x(p.over)},${y(p.team1_rate)}`).join(" ");

    const team2Points = data.points.filter((p) => p.team2_rate !== null);
    const line2 = team2Points.map((p) => `${x(p.over)},${y(p.team2_rate as number)}`).join(" ");

    const reqPoints = data.points.filter((p) => p.required_rate !== null);
    const lineReq = reqPoints.map((p) => `${x(p.over)},${y(p.required_rate as number)}`).join(" ");

    return { maxRate, x, y, line1, line2, lineReq, hasTeam2: team2Points.length > 0, hasRequired: reqPoints.length > 0 };
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
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load run rate data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || !geometry ? (
        <div className="flex h-56 items-center justify-center text-xs text-fg-faint">No run rate data for this match</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`${title}: ${data.team1_name} vs ${data.team2_name}`}>
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
            <text x={2} y={PAD_TOP + 4} className="fill-fg-faint text-[9px]">
              {geometry.maxRate.toFixed(0)}
            </text>
            <text x={2} y={HEIGHT - PAD_BOTTOM} className="fill-fg-faint text-[9px]">
              0
            </text>

            {geometry.hasRequired && (
              <polyline
                points={geometry.lineReq}
                fill="none"
                className="text-fg-faint"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            )}
            <polyline points={geometry.line1} fill="none" className="text-chart-1" stroke="currentColor" strokeWidth={2} />
            {geometry.hasTeam2 && (
              <polyline points={geometry.line2} fill="none" className="text-chart-2" stroke="currentColor" strokeWidth={2} />
            )}

            <line
              x1={PAD_LEFT}
              y1={HEIGHT - PAD_BOTTOM}
              x2={WIDTH - PAD_RIGHT}
              y2={HEIGHT - PAD_BOTTOM}
              className="text-line-strong"
              stroke="currentColor"
              strokeWidth={1}
            />
          </svg>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-fg-faint">
              <span className="h-2 w-2 rounded-full bg-chart-1" /> {data.team1_name}
            </span>
            {geometry.hasTeam2 && (
              <span className="flex items-center gap-1.5 text-xs text-fg-faint">
                <span className="h-2 w-2 rounded-full bg-chart-2" /> {data.team2_name}
              </span>
            )}
            {geometry.hasRequired && (
              <span className="flex items-center gap-1.5 text-xs text-fg-faint">
                <span className="h-0.5 w-3 border-t border-dashed border-fg-faint" /> Required rate
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
