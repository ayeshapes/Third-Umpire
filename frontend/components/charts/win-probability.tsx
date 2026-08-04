"use client";

/**
 * Ticket 9.2 -- Estimated Win Probability.
 *
 * Team 1's estimated win probability, ball by ball across both
 * innings, as a filled area against a 50% line -- area above the line
 * reads as "Team 1 favored," below as "Team 2 favored," so someone
 * scanning the shape (not the exact numbers) can see swings and how
 * decisive the finish was without reading the y-axis closely. This is
 * a model output the backend computes (from resources, required
 * rate, wickets in hand, etc) -- the chart itself only renders
 * whatever `team1_win_pct` series the endpoint returns.
 */

import { useMemo } from "react";
import { useChartData } from "@/hooks/use-chart-data";

export interface WinProbabilityPoint {
  /** Cumulative ball count across the match, used as the x-axis so both innings sit on one continuous timeline. */
  ball: number;
  innings: 1 | 2;
  over: number;
  team1_win_pct: number; // 0-100
}

export interface WinProbabilityData {
  team1_name: string;
  team2_name: string;
  points: WinProbabilityPoint[];
}

export interface WinProbabilityProps {
  path: string;
  title?: string;
}

const WIDTH = 560;
const HEIGHT = 220;
const PAD_LEFT = 30;
const PAD_BOTTOM = 22;
const PAD_TOP = 10;
const PAD_RIGHT = 10;

export function WinProbability({ path, title = "Estimated Win Probability" }: WinProbabilityProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<WinProbabilityData>(path);

  const geometry = useMemo(() => {
    if (!data || data.points.length === 0) return null;
    const maxBall = Math.max(...data.points.map((p) => p.ball), 1);

    const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const x = (ball: number) => PAD_LEFT + (ball / maxBall) * plotW;
    const y = (pct: number) => PAD_TOP + plotH - (pct / 100) * plotH;
    const yMid = y(50);

    const line = data.points.map((p) => `${x(p.ball)},${y(p.team1_win_pct)}`).join(" ");
    const area = `${x(0)},${yMid} ${line} ${x(data.points[data.points.length - 1].ball)},${yMid}`;

    // Where innings 2 starts, for a divider line.
    const secondInningsStart = data.points.find((p) => p.innings === 2);

    const final = data.points[data.points.length - 1].team1_win_pct;

    return { x, y, yMid, line, area, secondInningsStart, final };
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
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load win probability data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || !geometry ? (
        <div className="flex h-56 items-center justify-center text-xs text-fg-faint">No win probability model available for this match</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`${title}: ${data.team1_name} vs ${data.team2_name}`}>
            <text x={2} y={PAD_TOP + 4} className="fill-fg-faint text-[9px]">
              100%
            </text>
            <text x={2} y={geometry.yMid + 3} className="fill-fg-faint text-[9px]">
              50%
            </text>
            <text x={2} y={HEIGHT - PAD_BOTTOM} className="fill-fg-faint text-[9px]">
              0%
            </text>

            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={geometry.yMid}
              y2={geometry.yMid}
              className="text-line-strong"
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="2 4"
            />

            {geometry.secondInningsStart && (
              <line
                x1={geometry.x(geometry.secondInningsStart.ball)}
                x2={geometry.x(geometry.secondInningsStart.ball)}
                y1={PAD_TOP}
                y2={HEIGHT - PAD_BOTTOM}
                className="text-line-strong"
                stroke="currentColor"
                strokeWidth={1}
              />
            )}

            <polygon points={geometry.area} className="fill-chart-1/15" />
            <polyline points={geometry.line} fill="none" className="text-chart-1" stroke="currentColor" strokeWidth={2} />

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

          <p className="mt-2 text-center text-xs text-fg-faint">
            {geometry.final >= 50
              ? `${data.team1_name} finished ${geometry.final.toFixed(0)}% favored`
              : `${data.team2_name} finished ${(100 - geometry.final).toFixed(0)}% favored`}
          </p>
        </div>
      )}
    </div>
  );
}
