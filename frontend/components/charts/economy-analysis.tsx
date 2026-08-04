"use client";

/**
 * Ticket 8.2 -- Economy Analysis.
 *
 * Economy rate (runs/over) compared across match phases, plus the
 * scope-wide overall figure as a reference line -- "where do I leak
 * runs" in a way a single overall economy KPI (see
 * <BowlingKpiCards>) can't show. Bars sit on an inverted sense of
 * "good": shorter bars (lower economy) are better, called out
 * directly via colour intensity rather than making the reader do
 * that translation themselves.
 */

import { useChartData } from "@/hooks/use-chart-data";

export type Phase = "powerplay" | "middle" | "death";

export interface EconomyByPhase {
  phase: Phase;
  economy: number;
  overs: number;
}

export interface EconomyAnalysisData {
  overall_economy: number;
  by_phase: EconomyByPhase[];
}

export interface EconomyAnalysisProps {
  path: string;
  title?: string;
}

const PHASE_LABEL: Record<Phase, string> = {
  powerplay: "Powerplay",
  middle: "Middle",
  death: "Death",
};

const PHASE_ORDER: Phase[] = ["powerplay", "middle", "death"];

export function EconomyAnalysis({ path, title = "Economy Analysis" }: EconomyAnalysisProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<EconomyAnalysisData>(path);

  const byPhase = new Map((data?.by_phase ?? []).map((d) => [d.phase, d]));
  const maxEconomy = data && data.by_phase.length > 0 ? Math.max(...data.by_phase.map((d) => d.economy), data.overall_economy, 1) : 1;

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">{title}</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load economy data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="flex h-40 items-center justify-center text-xs text-fg-faint">No economy data for the current filters</div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <div className="mb-4 flex items-baseline gap-2">
            <span className="scoreboard-digits text-2xl font-semibold text-ivory">{data.overall_economy.toFixed(2)}</span>
            <span className="text-xs text-fg-faint">overall economy</span>
          </div>

          <div className="flex flex-col gap-3">
            {PHASE_ORDER.map((phase) => {
              const p = byPhase.get(phase);
              const economy = p?.economy ?? 0;
              const betterThanOverall = p ? economy <= data.overall_economy : false;
              return (
                <div key={phase} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-fg-faint">{PHASE_LABEL[phase]}</span>
                  <div className="relative h-6 flex-1 overflow-hidden rounded bg-surface-2">
                    <div
                      className={`h-full rounded ${betterThanOverall ? "bg-ivory/50" : "bg-chart-1/60"}`}
                      style={{ width: `${p ? Math.max((economy / maxEconomy) * 100, 4) : 0}%` }}
                      title={`${PHASE_LABEL[phase]}: ${economy.toFixed(2)} economy over ${p?.overs ?? 0} overs`}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-fg-muted">
                    {p ? economy.toFixed(2) : "--"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
