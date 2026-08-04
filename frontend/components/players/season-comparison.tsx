"use client";

/**
 * Ticket 12.1 -- Season Comparison.
 *
 * Both players' output plotted per season on one axis, so you can
 * read whose career is trending up/down and which seasons either
 * player peaked in -- a single combined "career totals" number
 * (Career Statistics, above) can't show that shape at all.
 *
 * Runs/Wickets toggle: the two players being compared won't always
 * share a primary discipline (a top-order bat vs. a strike bowler is
 * exactly the kind of comparison this page exists for), so this
 * defaults to Runs but lets you flip to Wickets rather than forcing
 * one axis to fit both careers.
 */

import { useMemo, useState } from "react";
import { usePlayerComparison } from "@/hooks/use-player-comparison";

export interface SeasonComparisonPoint {
  season_year: number;
  player_a_runs: number;
  player_b_runs: number;
  player_a_wickets: number;
  player_b_wickets: number;
}

export interface SeasonComparisonData {
  player_a_name: string;
  player_b_name: string;
  points: SeasonComparisonPoint[];
}

export interface SeasonComparisonProps {
  path: string;
  playerAId: number | null;
  playerBId: number | null;
}

const WIDTH = 560;
const HEIGHT = 220;
const PAD_LEFT = 32;
const PAD_BOTTOM = 22;
const PAD_TOP = 10;
const PAD_RIGHT = 10;

type Metric = "runs" | "wickets";

export function SeasonComparison({ path, playerAId, playerBId }: SeasonComparisonProps) {
  const [metric, setMetric] = useState<Metric>("runs");
  const { data, isLoading, isError, error, refetch, isFetching } = usePlayerComparison<SeasonComparisonData>(
    path,
    playerAId,
    playerBId
  );

  const geometry = useMemo(() => {
    if (!data || data.points.length === 0) return null;
    const aKey: keyof SeasonComparisonPoint = metric === "runs" ? "player_a_runs" : "player_a_wickets";
    const bKey: keyof SeasonComparisonPoint = metric === "runs" ? "player_b_runs" : "player_b_wickets";

    const sorted = [...data.points].sort((p1, p2) => p1.season_year - p2.season_year);
    const maxVal = Math.max(...sorted.map((p) => Math.max(p[aKey], p[bKey])), 1);

    const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const x = (i: number) => PAD_LEFT + (sorted.length === 1 ? plotW / 2 : (i / (sorted.length - 1)) * plotW);
    const y = (v: number) => PAD_TOP + plotH - (v / maxVal) * plotH;

    const lineA = sorted.map((p, i) => `${x(i)},${y(p[aKey])}`).join(" ");
    const lineB = sorted.map((p, i) => `${x(i)},${y(p[bKey])}`).join(" ");

    return { sorted, x, y, lineA, lineB, maxVal, aKey, bKey };
  }, [data, metric]);

  if (playerAId === null || playerBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two players above to compare season by season.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Season Comparison</h3>
        <div className="flex items-center gap-3">
          {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
          <div className="flex gap-1 rounded-full border border-line-strong p-0.5">
            {(["runs", "wickets"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                aria-pressed={metric === m}
                className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  metric === m ? "bg-crimson-bright/15 text-ivory" : "text-fg-faint hover:text-ivory"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading season comparison" className="h-56 w-full animate-pulse rounded-lg bg-surface-2" />
      ) : isError ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load season comparison"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || !geometry ? (
        <div className="flex h-56 items-center justify-center text-xs text-fg-faint">No season data for these players</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label={`Season comparison of ${metric}: ${data.player_a_name} vs ${data.player_b_name}`}
          >
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
              {geometry.maxVal}
            </text>
            <text x={2} y={HEIGHT - PAD_BOTTOM} className="fill-fg-faint text-[9px]">
              0
            </text>

            <polyline points={geometry.lineB} fill="none" className="text-fg-muted" stroke="currentColor" strokeWidth={2} />
            <polyline points={geometry.lineA} fill="none" className="text-crimson-bright" stroke="currentColor" strokeWidth={2} />

            {geometry.sorted.map((p, i) => (
              <g key={p.season_year}>
                <circle cx={geometry.x(i)} cy={geometry.y(p[geometry.aKey])} r={2.5} className="fill-crimson-bright" />
                <circle cx={geometry.x(i)} cy={geometry.y(p[geometry.bKey])} r={2.5} className="fill-fg-muted" />
                <text x={geometry.x(i)} y={HEIGHT - 6} textAnchor="middle" className="fill-fg-faint text-[9px]">
                  {p.season_year}
                </text>
              </g>
            ))}

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
              <span className="h-2 w-2 rounded-full bg-crimson-bright" /> {data.player_a_name}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-fg-faint">
              <span className="h-2 w-2 rounded-full bg-fg-muted" /> {data.player_b_name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
