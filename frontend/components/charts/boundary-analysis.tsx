"use client";

/**
 * Ticket 7.2 -- Boundary Analysis.
 *
 * Two views of the same underlying boundary data, since they answer
 * different questions: a donut for "4s vs 6s, and how much of total
 * scoring came off boundaries at all" (a part-of-whole question,
 * which a donut fits and a bar chart doesn't), plus a small grouped
 * breakdown by match phase (powerplay/middle/death) for "*when* were
 * they hit" -- phase comparison genuinely is a bar-shaped question,
 * so it stays a bar here rather than being forced into another shape
 * for variety's sake.
 */

import { useChartData } from "@/hooks/use-chart-data";

export interface BoundaryPhaseBreakdown {
  phase: "powerplay" | "middle" | "death";
  fours: number;
  sixes: number;
}

export interface BoundaryAnalysisData {
  total_fours: number;
  total_sixes: number;
  runs_from_boundaries: number;
  total_runs: number;
  by_phase: BoundaryPhaseBreakdown[];
}

export interface BoundaryAnalysisProps {
  path: string;
  title?: string;
}

const PHASE_LABEL: Record<BoundaryPhaseBreakdown["phase"], string> = {
  powerplay: "Powerplay",
  middle: "Middle",
  death: "Death",
};

const DONUT_SIZE = 140;
const DONUT_RADIUS = 54;
const DONUT_STROKE = 18;
const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export function BoundaryAnalysis({ path, title = "Boundary Analysis" }: BoundaryAnalysisProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<BoundaryAnalysisData>(path);

  const totalBoundaries = data ? data.total_fours + data.total_sixes : 0;
  const fourFraction = totalBoundaries > 0 && data ? data.total_fours / totalBoundaries : 0;
  const boundaryRunPct = data && data.total_runs > 0 ? (data.runs_from_boundaries / data.total_runs) * 100 : 0;
  const maxPhaseCount = data ? Math.max(...data.by_phase.map((p) => p.fours + p.sixes), 1) : 1;

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
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load boundary data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || totalBoundaries === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-fg-faint">No boundary data for the current filters</div>
      ) : (
        <div className={`flex flex-col items-center gap-6 sm:flex-row sm:items-center transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="relative shrink-0">
            <svg viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} className="h-36 w-36 -rotate-90" role="img" aria-label="Fours vs sixes split">
              <circle
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_RADIUS}
                fill="none"
                className="text-chart-1"
                stroke="currentColor"
                strokeWidth={DONUT_STROKE}
                strokeDasharray={`${CIRCUMFERENCE * (1 - fourFraction)} ${CIRCUMFERENCE}`}
                strokeDashoffset={-CIRCUMFERENCE * fourFraction}
              />
              <circle
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_RADIUS}
                fill="none"
                className="text-ivory"
                stroke="currentColor"
                strokeWidth={DONUT_STROKE}
                strokeDasharray={`${CIRCUMFERENCE * fourFraction} ${CIRCUMFERENCE}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="scoreboard-digits text-lg font-semibold text-ivory">{boundaryRunPct.toFixed(0)}%</span>
              <span className="text-[10px] text-fg-faint">of runs</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <div className="flex gap-4 text-xs text-fg-faint">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-ivory" /> {data.total_fours} fours
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-1" /> {data.total_sixes} sixes
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {data.by_phase.map((p) => (
                <div key={p.phase} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[10px] uppercase tracking-widest text-fg-faint">{PHASE_LABEL[p.phase]}</span>
                  <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full bg-ivory" style={{ width: `${(p.fours / maxPhaseCount) * 100}%` }} title={`${p.fours} fours`} />
                    <div className="h-full bg-chart-1" style={{ width: `${(p.sixes / maxPhaseCount) * 100}%` }} title={`${p.sixes} sixes`} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-fg-muted">{p.fours + p.sixes}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
