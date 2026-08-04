"use client";

/**
 * Ticket 7.2 -- Wagon Wheel.
 *
 * Radial shot-direction chart: one line per scoring shot, from the
 * center of the field out to where it was played, coloured by runs
 * scored. This is the one visualization on this page that a bar
 * chart genuinely cannot represent -- direction is the entire point.
 *
 * `angle` is degrees clockwise from straight down the ground (12
 * o'clock / batsman facing up the pitch), matching the convention
 * broadcasters use. `distance` is normalized 0-1 (fraction of the way
 * to the boundary) so the field circle can be any pixel size without
 * the data needing to know about it.
 */

import { useChartData } from "@/hooks/use-chart-data";

export interface WagonWheelShot {
  angle: number; // degrees, 0-360, clockwise from straight down the ground
  distance: number; // 0-1, fraction of the way to the boundary
  runs: 1 | 2 | 3 | 4 | 6;
}

const SIZE = 280;
const CENTER = SIZE / 2;
const FIELD_RADIUS = SIZE / 2 - 16;

const RUN_STYLE: Record<WagonWheelShot["runs"], { className: string; label: string }> = {
  1: { className: "text-fg-faint", label: "1s / 2s / 3s" },
  2: { className: "text-fg-faint", label: "1s / 2s / 3s" },
  3: { className: "text-fg-faint", label: "1s / 2s / 3s" },
  4: { className: "text-ivory", label: "Fours" },
  6: { className: "text-chart-1", label: "Sixes" },
};

function polarToXY(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // -90 so 0deg points "up" (straight down the ground)
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

export interface WagonWheelProps {
  path: string;
  title?: string;
}

export function WagonWheel({ path, title = "Wagon Wheel" }: WagonWheelProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<WagonWheelShot[]>(path);

  const legendEntries = Object.entries(RUN_STYLE).reduce<Record<string, string>>((acc, [, v]) => {
    acc[v.label] = v.className;
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex h-64 items-center justify-center">
          <div className="h-56 w-56 animate-pulse rounded-full bg-surface-2" />
        </div>
      ) : isError ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load shot data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-xs text-fg-faint">No shot data for the current filters</div>
      ) : (
        <div className={`flex flex-col items-center gap-4 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-64 w-64" role="img" aria-label={`${title} shot chart`}>
            {/* Field boundary + pitch reference circles */}
            <circle cx={CENTER} cy={CENTER} r={FIELD_RADIUS} fill="none" className="text-line-strong" stroke="currentColor" strokeWidth={1.5} />
            <circle cx={CENTER} cy={CENTER} r={FIELD_RADIUS * 0.55} fill="none" className="text-line-strong" stroke="currentColor" strokeWidth={1} strokeDasharray="3 4" />
            <line x1={CENTER} y1={16} x2={CENTER} y2={SIZE - 16} className="text-line-strong" stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" />
            <line x1={16} y1={CENTER} x2={SIZE - 16} y2={CENTER} className="text-line-strong" stroke="currentColor" strokeWidth={1} strokeDasharray="2 4" />

            {data.map((shot, i) => {
              const { x, y } = polarToXY(shot.angle, shot.distance * FIELD_RADIUS);
              const style = RUN_STYLE[shot.runs] ?? RUN_STYLE[1];
              return (
                <g key={i} className={style.className}>
                  <line x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="currentColor" strokeWidth={shot.runs >= 4 ? 1.75 : 1} strokeOpacity={0.75} strokeLinecap="round" />
                  <circle cx={x} cy={y} r={shot.runs >= 4 ? 2.5 : 1.5} fill="currentColor">
                    <title>{`${shot.runs} run${shot.runs === 1 ? "" : "s"}`}</title>
                  </circle>
                </g>
              );
            })}

            {/* Batsman marker at center */}
            <circle cx={CENTER} cy={CENTER} r={3} className="text-fg-muted" fill="currentColor" />
          </svg>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {Object.entries(legendEntries).map(([label, className]) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-fg-faint">
                <span className={`h-2 w-2 rounded-full ${className} bg-current`} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
