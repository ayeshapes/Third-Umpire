"use client";

/**
 * Ticket 10.1 -- Historical Trends.
 *
 * Average score by season at this venue, as a line -- the one chart
 * on the page answering "has this ground changed over time" (pitch
 * relaid, boundary dimensions changed, tournament moved to a
 * different part of the season, etc), which every other section here
 * necessarily flattens into a single all-time number. Matches count
 * per season is plotted as bar height underneath so a season with a
 * scoring outlier can be read against how many matches that average
 * is actually built from.
 */

import { useMemo } from "react";
import { useChartData } from "@/hooks/use-chart-data";

export interface HistoricalTrendPoint {
  season: string;
  avg_score: number;
  matches: number;
}

export interface HistoricalTrendsData {
  points: HistoricalTrendPoint[];
}

export interface HistoricalTrendsProps {
  path: string;
  title?: string;
}

const WIDTH = 560;
const HEIGHT = 240;
const PAD_LEFT = 34;
const PAD_BOTTOM = 46; // extra room for rotated season labels + matches bars
const PAD_TOP = 14;
const PAD_RIGHT = 10;
const BAR_ZONE_H = 28;

export function HistoricalTrends({ path, title = "Historical Trends" }: HistoricalTrendsProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<HistoricalTrendsData>(path);

  const geometry = useMemo(() => {
    if (!data || data.points.length === 0) return null;
    const maxScore = Math.max(...data.points.map((p) => p.avg_score), 1);
    const maxMatches = Math.max(...data.points.map((p) => p.matches), 1);
    const lineBottom = HEIGHT - PAD_BOTTOM - BAR_ZONE_H;

    const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const step = data.points.length > 1 ? plotW / (data.points.length - 1) : 0;

    const x = (i: number) => PAD_LEFT + i * step;
    const y = (score: number) => PAD_TOP + (lineBottom - PAD_TOP) * (1 - score / maxScore);

    const line = data.points.map((p, i) => `${x(i)},${y(p.avg_score)}`).join(" ");

    return { x, y, line, lineBottom, maxScore, maxMatches };
  }, [data]);

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="h-60 w-full animate-pulse rounded-lg bg-surface-2" />
      ) : isError ? (
        <div className="flex h-60 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load historical trends"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || !geometry ? (
        <div className="flex h-60 items-center justify-center text-xs text-fg-faint">Not enough seasons of data for this venue yet</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`${title}: average score by season`}>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line
                key={f}
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={PAD_TOP + (geometry.lineBottom - PAD_TOP) * (1 - f)}
                y2={PAD_TOP + (geometry.lineBottom - PAD_TOP) * (1 - f)}
                className="text-line-strong"
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray="2 4"
              />
            ))}
            <text x={2} y={PAD_TOP + 4} className="fill-fg-faint text-[9px]">
              {geometry.maxScore.toFixed(0)}
            </text>
            <text x={2} y={geometry.lineBottom} className="fill-fg-faint text-[9px]">
              0
            </text>

            <polyline points={geometry.line} fill="none" className="text-crimson-bright" stroke="currentColor" strokeWidth={2} />
            {data.points.map((p, i) => (
              <circle key={p.season} cx={geometry.x(i)} cy={geometry.y(p.avg_score)} r={3} className="text-ivory" fill="currentColor" />
            ))}

            {/* Matches-hosted bars, underneath the line as volume context */}
            {data.points.map((p, i) => {
              const barH = (p.matches / geometry.maxMatches) * (BAR_ZONE_H - 4);
              return (
                <rect
                  key={`bar-${p.season}`}
                  x={geometry.x(i) - 6}
                  y={geometry.lineBottom + 16 + (BAR_ZONE_H - 4 - barH)}
                  width={12}
                  height={Math.max(barH, 2)}
                  className="fill-line-strong"
                  rx={1.5}
                >
                  <title>{`${p.season}: ${p.matches} match${p.matches === 1 ? "" : "es"}`}</title>
                </rect>
              );
            })}

            {data.points.map((p, i) => (
              <text
                key={`label-${p.season}`}
                x={geometry.x(i)}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="fill-fg-faint text-[9px]"
              >
                {p.season}
              </text>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
