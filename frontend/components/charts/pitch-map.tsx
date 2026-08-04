"use client";

/**
 * Ticket 8.2 -- Pitch Map.
 *
 * Top-down scatter of where each delivery pitched: `line` (-1 full
 * wide of off .. 0 stumps .. 1 full wide of leg) and `length` (0 =
 * full toss / yorker at the batter's end, 1 = short/bouncer back
 * toward the bowler) place each dot on a stylised pitch rectangle,
 * coloured by outcome. This is the bowling-side equivalent of
 * <WagonWheel> -- position on a 2D plane is the entire point, which
 * no bar/line/donut chart can substitute for.
 */

import { useChartData } from "@/hooks/use-chart-data";

export type DeliveryOutcome = "wicket" | "dot" | "runs" | "boundary" | "six";

export interface PitchMapDelivery {
  line: number; // -1 (wide of off) .. 0 (stumps) .. 1 (wide of leg)
  length: number; // 0 (full/yorker) .. 1 (short/bouncer)
  outcome: DeliveryOutcome;
}

export interface PitchMapProps {
  path: string;
  title?: string;
}

const WIDTH = 220;
const HEIGHT = 320;
const PAD = 20;
const PITCH_W = WIDTH - PAD * 2;
const PITCH_H = HEIGHT - PAD * 2;

const OUTCOME_STYLE: Record<DeliveryOutcome, { className: string; label: string; r: number }> = {
  wicket: { className: "text-chart-1", label: "Wicket", r: 3.5 },
  boundary: { className: "text-ivory", label: "Four", r: 3 },
  six: { className: "text-chart-6", label: "Six", r: 4 },
  dot: { className: "text-fg-faint", label: "Dot ball", r: 2 },
  runs: { className: "text-fg-muted", label: "Runs", r: 2 },
};

// Length bands used for the reference lines drawn on the pitch.
const LENGTH_BANDS = [
  { at: 0.12, label: "Yorker" },
  { at: 0.32, label: "Full" },
  { at: 0.55, label: "Good" },
  { at: 0.78, label: "Short" },
];

function toXY(line: number, length: number) {
  const x = PAD + ((line + 1) / 2) * PITCH_W;
  const y = PAD + length * PITCH_H;
  return { x, y };
}

export function PitchMap({ path, title = "Pitch Map" }: PitchMapProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<PitchMapDelivery[]>(path);

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex h-72 items-center justify-center">
          <div className="h-64 w-44 animate-pulse rounded-lg bg-surface-2" />
        </div>
      ) : isError ? (
        <div className="flex h-72 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load pitch map data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-xs text-fg-faint">No delivery data for the current filters</div>
      ) : (
        <div className={`flex flex-col items-center gap-4 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-72 w-auto" role="img" aria-label={`${title} delivery chart`}>
            <rect x={PAD} y={PAD} width={PITCH_W} height={PITCH_H} rx={4} fill="none" className="text-line-strong" stroke="currentColor" strokeWidth={1.5} />
            <line
              x1={PAD + PITCH_W / 2}
              y1={PAD}
              x2={PAD + PITCH_W / 2}
              y2={PAD + PITCH_H}
              className="text-line-strong"
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            {LENGTH_BANDS.map((b) => (
              <g key={b.label}>
                <line
                  x1={PAD}
                  y1={PAD + b.at * PITCH_H}
                  x2={PAD + PITCH_W}
                  y2={PAD + b.at * PITCH_H}
                  className="text-line-strong"
                  stroke="currentColor"
                  strokeWidth={0.5}
                  strokeDasharray="1 3"
                />
                <text x={WIDTH - PAD + 2} y={PAD + b.at * PITCH_H + 3} className="fill-fg-faint" style={{ fontSize: 7 }}>
                  {b.label}
                </text>
              </g>
            ))}
            {/* Stumps at the batter's (top) end */}
            <g className="text-fg-muted" stroke="currentColor" strokeWidth={1.2}>
              <line x1={PAD + PITCH_W / 2 - 4} y1={PAD - 8} x2={PAD + PITCH_W / 2 - 4} y2={PAD} />
              <line x1={PAD + PITCH_W / 2} y1={PAD - 8} x2={PAD + PITCH_W / 2} y2={PAD} />
              <line x1={PAD + PITCH_W / 2 + 4} y1={PAD - 8} x2={PAD + PITCH_W / 2 + 4} y2={PAD} />
            </g>

            {data.map((d, i) => {
              const { x, y } = toXY(Math.max(-1, Math.min(1, d.line)), Math.max(0, Math.min(1, d.length)));
              const style = OUTCOME_STYLE[d.outcome] ?? OUTCOME_STYLE.runs;
              return (
                <circle key={i} cx={x} cy={y} r={style.r} className={style.className} fill="currentColor" fillOpacity={0.85}>
                  <title>{style.label}</title>
                </circle>
              );
            })}
          </svg>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {(Object.keys(OUTCOME_STYLE) as DeliveryOutcome[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-xs text-fg-faint">
                <span className={`h-2 w-2 rounded-full ${OUTCOME_STYLE[k].className} bg-current`} />
                {OUTCOME_STYLE[k].label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
