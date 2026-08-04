"use client";

/**
 * Ticket 10.1 -- Batting Conditions.
 *
 * "What's it like to bat here" -- headline scoring numbers (average
 * first/second innings score, runs per over, boundary%, dot ball%)
 * plus a per-phase run-rate breakdown, so a flat top-line average can
 * still be read against *where* in the innings the runs actually
 * come from (e.g. a venue can average low overall but still be easy
 * scoring in the powerplay). Mirrors <BowlingConditions>'s shape by
 * design -- same venue, opposite side of the ball.
 */

import { useChartData } from "@/hooks/use-chart-data";
import { StatCard, StatCardGrid } from "@/components/batting/stat-card";

export interface PhaseRunRate {
  phase: "powerplay" | "middle" | "death";
  run_rate: number;
}

export interface BattingConditionsData {
  avg_first_innings_score: number;
  avg_second_innings_score: number;
  avg_runs_per_over: number;
  boundary_pct: number; // % of balls faced that go for 4 or 6
  dot_ball_pct: number;
  phase_run_rates: PhaseRunRate[];
}

export interface BattingConditionsProps {
  path: string;
}

const PHASE_LABELS: Record<PhaseRunRate["phase"], string> = {
  powerplay: "Powerplay",
  middle: "Middle",
  death: "Death",
};

export function BattingConditions({ path }: BattingConditionsProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<BattingConditionsData>(path);

  const maxRate = data && data.phase_run_rates.length > 0 ? Math.max(...data.phase_run_rates.map((p) => p.run_rate), 1) : 1;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Batting Conditions</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load batting conditions"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <StatCardGrid>
            <StatCard label="Avg 1st Innings" value={data ? data.avg_first_innings_score.toFixed(0) : undefined} isLoading={isLoading} />
            <StatCard label="Avg 2nd Innings" value={data ? data.avg_second_innings_score.toFixed(0) : undefined} isLoading={isLoading} />
            <StatCard label="Runs / Over" value={data ? data.avg_runs_per_over.toFixed(2) : undefined} isLoading={isLoading} />
            <StatCard label="Boundary %" value={data ? `${data.boundary_pct.toFixed(1)}%` : undefined} isLoading={isLoading} />
          </StatCardGrid>

          <div className="mt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-fg-faint">Run Rate by Phase</p>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-7 w-full animate-pulse rounded bg-surface-2" />
                ))}
              </div>
            ) : !data || data.phase_run_rates.length === 0 ? (
              <p className="text-xs text-fg-faint">No phase breakdown available.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.phase_run_rates.map((p) => (
                  <div key={p.phase} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-fg-faint">{PHASE_LABELS[p.phase]}</span>
                    <div className="relative h-5 flex-1 overflow-hidden rounded bg-surface-2">
                      <div className="h-full rounded bg-crimson-bright/60" style={{ width: `${Math.max((p.run_rate / maxRate) * 100, 4)}%` }} />
                    </div>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-fg-muted">{p.run_rate.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
