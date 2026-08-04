"use client";

/**
 * Ticket 7.3 -- Match Conditions Analysis: Match Phase Analysis.
 *
 * Powerplay / Middle overs / Death overs (the same three-way split
 * used by the `phase` filter, see store/filters/types.ts) shown
 * side-by-side so the tradeoffs of each phase are visible at once --
 * e.g. a batter who accelerates in the death overs at the cost of a
 * higher dismissal rate. Three stat columns rather than one bar chart
 * because each phase carries several different numbers (SR, dot%,
 * dismissal%) that aren't all on the same scale.
 */

import { useChartData } from "@/hooks/use-chart-data";

export type Phase = "powerplay" | "middle" | "death";

export interface PhaseBattingStat {
  phase: Phase;
  runs: number;
  balls: number;
  strike_rate: number;
  dismissals: number;
  dot_percent: number;
  boundary_percent: number;
}

export interface PhaseAnalysisProps {
  path: string;
  title?: string;
}

const PHASE_LABEL: Record<Phase, string> = {
  powerplay: "Powerplay",
  middle: "Middle Overs",
  death: "Death Overs",
};

const PHASE_ORDER: Phase[] = ["powerplay", "middle", "death"];

// Distinct color per phase so the three columns are scannable at a
// glance instead of all reading as the same brand-red bar.
const PHASE_COLOR: Record<Phase, string> = {
  powerplay: "bg-chart-1/70",
  middle: "bg-chart-2/70",
  death: "bg-chart-6/70",
};

export function PhaseAnalysis({ path, title = "Match Phase Analysis" }: PhaseAnalysisProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<PhaseBattingStat[]>(path);

  const byPhase = new Map((data ?? []).map((d) => [d.phase, d]));
  const maxSr = data && data.length > 0 ? Math.max(...data.map((d) => d.strike_rate), 1) : 1;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 w-full animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load phase data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-xs text-fg-faint">No phase data for the current filters</div>
      ) : (
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-3 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          {PHASE_ORDER.map((phase) => {
            const p = byPhase.get(phase);
            return (
              <div key={phase} className="flex flex-col gap-3 rounded-xl border border-line-strong/60 bg-void/40 p-4">
                <span className="text-xs font-medium uppercase tracking-widest text-fg-faint">{PHASE_LABEL[phase]}</span>
                <span className="scoreboard-digits text-2xl font-semibold text-ivory">
                  {p ? p.strike_rate.toFixed(1) : "--"}
                  <span className="ml-1 text-xs font-normal text-fg-faint">SR</span>
                </span>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className={`h-full rounded-full ${PHASE_COLOR[phase]}`} style={{ width: `${p ? Math.max((p.strike_rate / maxSr) * 100, 4) : 0}%` }} />
                </div>
                <dl className="grid grid-cols-2 gap-y-1 text-xs text-fg-muted">
                  <dt className="text-fg-faint">Runs</dt>
                  <dd className="text-right tabular-nums">{p?.runs ?? "--"}</dd>
                  <dt className="text-fg-faint">Dismissals</dt>
                  <dd className="text-right tabular-nums">{p?.dismissals ?? "--"}</dd>
                  <dt className="text-fg-faint">Dot %</dt>
                  <dd className="text-right tabular-nums">{p ? `${p.dot_percent.toFixed(0)}%` : "--"}</dd>
                  <dt className="text-fg-faint">Boundary %</dt>
                  <dd className="text-right tabular-nums">{p ? `${p.boundary_percent.toFixed(0)}%` : "--"}</dd>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
