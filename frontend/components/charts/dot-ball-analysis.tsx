"use client";

/**
 * Ticket 8.2 -- Dot Ball Analysis.
 *
 * Same two-view shape as <BoundaryAnalysis> on the batting side (a
 * donut for the part-of-whole "what fraction of balls bowled were
 * dots" question, plus a by-phase bar breakdown for "*when* am I
 * tying batters down") -- deliberately reusing that pattern rather
 * than inventing a new one, since it's the same kind of question
 * mirrored to the bowling side of the ball.
 */

import { useChartData } from "@/hooks/use-chart-data";

export type Phase = "powerplay" | "middle" | "death";

export interface DotBallPhaseBreakdown {
  phase: Phase;
  dot_balls: number;
  balls_bowled: number;
}

export interface DotBallAnalysisData {
  total_dot_balls: number;
  total_balls_bowled: number;
  by_phase: DotBallPhaseBreakdown[];
}

export interface DotBallAnalysisProps {
  path: string;
  title?: string;
}

const PHASE_LABEL: Record<Phase, string> = {
  powerplay: "Powerplay",
  middle: "Middle",
  death: "Death",
};

const DONUT_SIZE = 140;
const DONUT_RADIUS = 54;
const DONUT_STROKE = 18;
const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export function DotBallAnalysis({ path, title = "Dot Ball Analysis" }: DotBallAnalysisProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<DotBallAnalysisData>(path);

  const dotPct = data && data.total_balls_bowled > 0 ? data.total_dot_balls / data.total_balls_bowled : 0;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex h-48 items-center justify-center gap-6">
          <div className="h-32 w-32 animate-pulse rounded-full bg-surface-2" />
          <div className="flex-1 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-6 w-full animate-pulse rounded bg-surface-2" />
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load dot ball data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.total_balls_bowled === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-fg-faint">No delivery data for the current filters</div>
      ) : (
        <div className={`flex flex-col items-center gap-6 sm:flex-row sm:items-center transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="relative shrink-0">
            <svg viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} className="h-36 w-36 -rotate-90" role="img" aria-label="Dot ball percentage">
              <circle
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_RADIUS}
                fill="none"
                className="text-surface-2"
                stroke="currentColor"
                strokeWidth={DONUT_STROKE}
              />
              <circle
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_RADIUS}
                fill="none"
                className="text-chart-1"
                stroke="currentColor"
                strokeWidth={DONUT_STROKE}
                strokeDasharray={`${CIRCUMFERENCE * dotPct} ${CIRCUMFERENCE}`}
                strokeLinecap="butt"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="scoreboard-digits text-lg font-semibold text-ivory">{(dotPct * 100).toFixed(0)}%</span>
              <span className="text-[10px] text-fg-faint">dot balls</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <span className="text-xs text-fg-faint">
              {data.total_dot_balls} of {data.total_balls_bowled} balls bowled
            </span>
            <div className="flex flex-col gap-2">
              {data.by_phase.map((p) => {
                const pct = p.balls_bowled > 0 ? (p.dot_balls / p.balls_bowled) * 100 : 0;
                return (
                  <div key={p.phase} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[10px] uppercase tracking-widest text-fg-faint">{PHASE_LABEL[p.phase]}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-chart-1/70" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-fg-muted">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
