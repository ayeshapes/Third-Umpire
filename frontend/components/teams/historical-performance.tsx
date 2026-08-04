"use client";

/**
 * Team Comparison Studio: Historical Performance.
 *
 * Both teams' form plotted per season on one axis -- same idea as
 * components/players/season-comparison.tsx, applied at team level --
 * so you can read whose trajectory is climbing/declining, independent
 * of how they've fared specifically against each other (that's
 * <HeadToHeadSummary>'s job). Win % / Net Run Rate toggle rather than
 * a single fixed axis: win% alone can hide a team that's winning
 * ugly vs. winning comfortably, which NRR captures instead.
 */

import { useMemo, useState } from "react";
import { useTeamComparison } from "@/hooks/use-team-comparison";

export interface TeamSeasonPoint {
  season_year: number;
  team_a_win_pct: number;
  team_b_win_pct: number;
  team_a_nrr: number;
  team_b_nrr: number;
}

export interface HistoricalPerformanceData {
  team_a_code: string;
  team_b_code: string;
  points: TeamSeasonPoint[];
}

export interface HistoricalPerformanceProps {
  path: string;
  teamAId: number | null;
  teamBId: number | null;
}

const WIDTH = 560;
const HEIGHT = 220;
const PAD_LEFT = 32;
const PAD_BOTTOM = 22;
const PAD_TOP = 10;
const PAD_RIGHT = 10;

type Metric = "win_pct" | "nrr";

const METRIC_LABEL: Record<Metric, string> = { win_pct: "Win %", nrr: "Net Run Rate" };

export function HistoricalPerformance({ path, teamAId, teamBId }: HistoricalPerformanceProps) {
  const [metric, setMetric] = useState<Metric>("win_pct");
  const { data, isLoading, isError, error, refetch, isFetching } = useTeamComparison<HistoricalPerformanceData>(
    path,
    teamAId,
    teamBId
  );

  const geometry = useMemo(() => {
    if (!data || data.points.length === 0) return null;
    const aKey: keyof TeamSeasonPoint = metric === "win_pct" ? "team_a_win_pct" : "team_a_nrr";
    const bKey: keyof TeamSeasonPoint = metric === "win_pct" ? "team_b_win_pct" : "team_b_nrr";

    const sorted = [...data.points].sort((p1, p2) => p1.season_year - p2.season_year);
    const values = sorted.flatMap((p) => [p[aKey], p[bKey]]);
    const maxVal = Math.max(...values, metric === "win_pct" ? 100 : 0.1);
    const minVal = metric === "nrr" ? Math.min(...values, 0) : 0;

    const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

    const x = (i: number) => PAD_LEFT + (sorted.length === 1 ? plotW / 2 : (i / (sorted.length - 1)) * plotW);
    const range = Math.max(maxVal - minVal, 0.001);
    const y = (v: number) => PAD_TOP + plotH - ((v - minVal) / range) * plotH;

    const lineA = sorted.map((p, i) => `${x(i)},${y(p[aKey])}`).join(" ");
    const lineB = sorted.map((p, i) => `${x(i)},${y(p[bKey])}`).join(" ");

    return { sorted, x, y, lineA, lineB, maxVal, minVal, aKey, bKey };
  }, [data, metric]);

  if (teamAId === null || teamBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two teams above to see historical performance.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Historical Performance</h3>
        <div className="flex items-center gap-3">
          {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
          <div className="flex gap-1 rounded-full border border-line-strong p-0.5">
            {(["win_pct", "nrr"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                aria-pressed={metric === m}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  metric === m ? "bg-crimson-bright/15 text-ivory" : "text-fg-faint hover:text-ivory"
                }`}
              >
                {METRIC_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading historical performance" className="h-56 w-full animate-pulse rounded-lg bg-surface-2" />
      ) : isError ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load historical performance"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || !geometry ? (
        <div className="flex h-56 items-center justify-center text-xs text-fg-faint">No historical data for these teams</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label={`Historical ${METRIC_LABEL[metric]}: ${data.team_a_code} vs ${data.team_b_code}`}
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
              {metric === "win_pct" ? `${geometry.maxVal.toFixed(0)}%` : geometry.maxVal.toFixed(2)}
            </text>
            <text x={2} y={HEIGHT - PAD_BOTTOM} className="fill-fg-faint text-[9px]">
              {metric === "win_pct" ? `${geometry.minVal.toFixed(0)}%` : geometry.minVal.toFixed(2)}
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
              <span className="h-2 w-2 rounded-full bg-crimson-bright" /> {data.team_a_code}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-fg-faint">
              <span className="h-2 w-2 rounded-full bg-fg-muted" /> {data.team_b_code}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
