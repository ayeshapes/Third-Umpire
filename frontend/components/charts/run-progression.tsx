"use client";

/**
 * Ticket 7.2 -- Run Progression.
 *
 * An individual batter's cumulative runs against balls faced, with
 * 50/100 milestones called out -- distinct from <WormGraph> (which
 * compares two *teams'* cumulative scoring by over): this is one
 * player's innings shape, on a balls-faced axis so strike-rate
 * changes (flat = quiet spell, steep = accelerating) are visible in
 * the slope, which an over-by-over team comparison can't show.
 */

import { useMemo } from "react";
import { useChartData } from "@/hooks/use-chart-data";

export interface RunProgressionPoint {
  ball: number; // cumulative balls faced
  cumulative_runs: number;
}

export interface RunProgressionData {
  player_name: string;
  final_runs: number;
  points: RunProgressionPoint[];
}

export interface RunProgressionProps {
  path: string;
  title?: string;
}

const WIDTH = 560;
const HEIGHT = 200;
const PAD_LEFT = 34;
const PAD_BOTTOM = 22;
const PAD_TOP = 14;
const PAD_RIGHT = 10;

const MILESTONES = [50, 100] as const;

export function RunProgression({ path, title = "Run Progression" }: RunProgressionProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<RunProgressionData>(path);

  const geometry = useMemo(() => {
    if (!data || data.points.length === 0) return null;
    const maxBall = Math.max(...data.points.map((p) => p.ball), 1);
    const maxRuns = Math.max(...data.points.map((p) => p.cumulative_runs), MILESTONES[0]);

    const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const x = (ball: number) => PAD_LEFT + (ball / maxBall) * plotW;
    const y = (runs: number) => PAD_TOP + plotH - (runs / maxRuns) * plotH;

    const line = data.points.map((p) => `${x(p.ball)},${y(p.cumulative_runs)}`).join(" ");

    // Where the line first crosses each milestone -- for a marker + label.
    const milestoneHits = MILESTONES.filter((m) => data.final_runs >= m).map((m) => {
      const hit = data.points.find((p) => p.cumulative_runs >= m);
      return hit ? { runs: m, x: x(hit.ball), y: y(hit.cumulative_runs) } : null;
    }).filter((m): m is NonNullable<typeof m> => m !== null);

    return { maxRuns, x, y, line, milestoneHits };
  }, [data]);

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="h-52 w-full animate-pulse rounded-lg bg-surface-2" />
      ) : isError ? (
        <div className="flex h-52 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load innings data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || !geometry ? (
        <div className="flex h-52 items-center justify-center text-xs text-fg-faint">No innings data for the current filters</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`${title} for ${data.player_name}`}>
            {MILESTONES.filter((m) => m <= geometry.maxRuns).map((m) => (
              <line
                key={m}
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={geometry.y(m)}
                y2={geometry.y(m)}
                className="text-line-strong"
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray="2 4"
              />
            ))}

            <polyline points={geometry.line} fill="none" className="text-chart-1" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />

            {geometry.milestoneHits.map((hit) => (
              <g key={hit.runs}>
                <circle cx={hit.x} cy={hit.y} r={3.5} className="text-ivory" fill="currentColor" />
                <text x={hit.x + 6} y={hit.y - 6} className="fill-fg-faint text-[9px]">
                  {hit.runs}
                </text>
              </g>
            ))}

            <line x1={PAD_LEFT} y1={HEIGHT - PAD_BOTTOM} x2={WIDTH - PAD_RIGHT} y2={HEIGHT - PAD_BOTTOM} className="text-line-strong" stroke="currentColor" strokeWidth={1} />
          </svg>

          <p className="mt-2 text-center text-xs text-fg-faint">
            {data.player_name} · {data.final_runs} runs off {data.points[data.points.length - 1]?.ball ?? 0} balls
          </p>
        </div>
      )}
    </div>
  );
}
