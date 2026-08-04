"use client";

/**
 * Team Comparison Studio: Shared Visualizations -- Skill Profile Radar.
 *
 * A "shape of the team" view across several phase/discipline
 * dimensions at once (e.g. Batting Power, Powerplay, Death Overs,
 * Bowling Depth, Fielding, Chasing) -- synthesizes Batting/Bowling/
 * Venue/Historical into one glanceable picture, which is exactly what
 * distinguishes a *shared* visualization from any single section's
 * own chart. Same normalized-radar mechanics as
 * components/players/comparison-radar-chart.tsx (axis scores arrive
 * pre-normalized 0-100 from the backend -- see that file's doc
 * comment for why that normalization can't happen client-side here).
 */

import { useMemo } from "react";
import { useTeamComparison } from "@/hooks/use-team-comparison";

export interface TeamRadarAxisScore {
  axis: string;
  /** 0-100, normalized against the qualifying team population. */
  team_a_score: number;
  team_b_score: number;
}

export interface TeamRadarComparisonData {
  team_a_code: string;
  team_b_code: string;
  axes: TeamRadarAxisScore[];
}

export interface TeamComparisonRadarChartProps {
  path: string;
  teamAId: number | null;
  teamBId: number | null;
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 44;
const RINGS = [0.25, 0.5, 0.75, 1];

function pointOnAxis(index: number, total: number, valueFraction: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  return {
    x: CENTER + Math.cos(angle) * RADIUS * valueFraction,
    y: CENTER + Math.sin(angle) * RADIUS * valueFraction,
  };
}

export function TeamComparisonRadarChart({ path, teamAId, teamBId }: TeamComparisonRadarChartProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useTeamComparison<TeamRadarComparisonData>(
    path,
    teamAId,
    teamBId
  );

  const geometry = useMemo(() => {
    if (!data || data.axes.length < 3) return null;
    const total = data.axes.length;

    const polygonA = data.axes.map((a, i) => pointOnAxis(i, total, a.team_a_score / 100));
    const polygonB = data.axes.map((a, i) => pointOnAxis(i, total, a.team_b_score / 100));

    const labels = data.axes.map((a, i) => ({
      axis: a.axis,
      ...pointOnAxis(i, total, 1.18),
    }));

    return {
      total,
      pointsA: polygonA.map((p) => `${p.x},${p.y}`).join(" "),
      pointsB: polygonB.map((p) => `${p.x},${p.y}`).join(" "),
      labels,
    };
  }, [data]);

  if (teamAId === null || teamBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two teams above to see their skill profile radar.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Skill Profile Radar</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading skill profile radar" className="mx-auto h-72 w-72 animate-pulse rounded-full bg-surface-2" />
      ) : isError ? (
        <div className="flex h-72 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load radar data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || !geometry ? (
        <div className="flex h-72 items-center justify-center text-xs text-fg-faint">Not enough dimensions to plot a radar for these teams</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mx-auto block w-full max-w-[320px]"
            role="img"
            aria-label={`Skill profile radar: ${data.team_a_code} vs ${data.team_b_code}`}
          >
            {RINGS.map((f) => (
              <polygon
                key={f}
                points={data.axes.map((_, i) => `${pointOnAxis(i, geometry.total, f).x},${pointOnAxis(i, geometry.total, f).y}`).join(" ")}
                fill="none"
                className="text-line-strong"
                stroke="currentColor"
                strokeWidth={1}
              />
            ))}

            {data.axes.map((_, i) => {
              const p = pointOnAxis(i, geometry.total, 1);
              return (
                <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} className="text-line-strong" stroke="currentColor" strokeWidth={1} />
              );
            })}

            <polygon points={geometry.pointsB} className="fill-fg-muted/15 text-fg-muted" stroke="currentColor" strokeWidth={1.5} />
            <polygon points={geometry.pointsA} className="fill-crimson-bright/20 text-crimson-bright" stroke="currentColor" strokeWidth={1.5} />

            {geometry.labels.map((l) => (
              <text key={l.axis} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" className="fill-fg-faint text-[9px]">
                {l.axis}
              </text>
            ))}
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
