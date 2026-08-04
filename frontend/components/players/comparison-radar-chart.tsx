"use client";

/**
 * Ticket 12.1 -- Radar Chart.
 *
 * A "shape of the game" view across several skill dimensions at once
 * (e.g. Power, Consistency, Finishing) -- the one thing none of the
 * other sections give you, since <CareerStatsComparison> reads one
 * stat at a time and <SeasonComparison>/<PlayerVenueComparison> both
 * plot a single metric.
 *
 * Axis scores arrive pre-normalized 0-100 from the backend rather
 * than computed client-side from raw averages/strike rates: turning
 * "batting average" into a 0-100 "Consistency" score is a percentile
 * call that needs the full player population to be meaningful, which
 * this page doesn't have -- see lib/api/players.ts's illustrative-
 * endpoint caveat.
 */

import { useMemo } from "react";
import { usePlayerComparison } from "@/hooks/use-player-comparison";

export interface RadarAxisScore {
  axis: string;
  /** 0-100, normalized against the qualifying player population. */
  player_a_score: number;
  player_b_score: number;
}

export interface RadarComparisonData {
  player_a_name: string;
  player_b_name: string;
  axes: RadarAxisScore[];
}

export interface ComparisonRadarChartProps {
  path: string;
  playerAId: number | null;
  playerBId: number | null;
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

export function ComparisonRadarChart({ path, playerAId, playerBId }: ComparisonRadarChartProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = usePlayerComparison<RadarComparisonData>(
    path,
    playerAId,
    playerBId
  );

  const geometry = useMemo(() => {
    if (!data || data.axes.length < 3) return null;
    const total = data.axes.length;

    const polygonA = data.axes.map((a, i) => pointOnAxis(i, total, a.player_a_score / 100));
    const polygonB = data.axes.map((a, i) => pointOnAxis(i, total, a.player_b_score / 100));

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

  if (playerAId === null || playerBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two players above to see their skill radar.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Radar Chart</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading radar chart" className="mx-auto h-72 w-72 animate-pulse rounded-full bg-surface-2" />
      ) : isError ? (
        <div className="flex h-72 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load radar data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || !geometry ? (
        <div className="flex h-72 items-center justify-center text-xs text-fg-faint">Not enough dimensions to plot a radar for these players</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mx-auto block w-full max-w-[320px]"
            role="img"
            aria-label={`Skill radar: ${data.player_a_name} vs ${data.player_b_name}`}
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
                <line
                  key={i}
                  x1={CENTER}
                  y1={CENTER}
                  x2={p.x}
                  y2={p.y}
                  className="text-line-strong"
                  stroke="currentColor"
                  strokeWidth={1}
                />
              );
            })}

            <polygon points={geometry.pointsB} className="fill-fg-muted/15 text-fg-muted" stroke="currentColor" strokeWidth={1.5} />
            <polygon points={geometry.pointsA} className="fill-crimson-bright/20 text-crimson-bright" stroke="currentColor" strokeWidth={1.5} />

            {geometry.labels.map((l) => (
              <text
                key={l.axis}
                x={l.x}
                y={l.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-fg-faint text-[9px]"
              >
                {l.axis}
              </text>
            ))}
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
