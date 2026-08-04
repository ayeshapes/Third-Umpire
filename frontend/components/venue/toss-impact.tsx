"use client";

/**
 * Ticket 10.1 -- Toss Impact.
 *
 * "Does winning the toss actually matter here" -- match-win% for
 * winning the toss at all, plus the split for what the toss-winner
 * *chose* to do (bat vs bowl first) and how that choice panned out.
 * Venues vary a lot on this (some are so bat-first-friendly the toss
 * is nearly the whole game; others it's close to a coin flip) so this
 * is deliberately its own section rather than a line inside Average
 * Scores.
 */

import { useChartData } from "@/hooks/use-chart-data";
import { StatCard, StatCardGrid } from "@/components/batting/stat-card";

export interface TossImpactData {
  toss_winner_match_win_pct: number;
  bat_first_win_pct: number;
  bowl_first_win_pct: number;
  bat_first_chosen_pct: number; // how often toss-winners here elect to bat
  bowl_first_chosen_pct: number;
  sample_size: number;
}

export interface TossImpactProps {
  path: string;
}

export function TossImpact({ path }: TossImpactProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<TossImpactData>(path);

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Toss Impact</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load toss data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <StatCard
            label="Toss Winner Also Wins Match"
            value={data ? `${data.toss_winner_match_win_pct.toFixed(0)}%` : undefined}
            sublabel={data ? `Across ${data.sample_size} matches` : undefined}
            isLoading={isLoading}
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line-strong p-3">
              <p className="text-xs font-medium uppercase tracking-widest text-fg-faint">Elect to Bat</p>
              {isLoading ? (
                <div className="mt-2 h-6 w-16 animate-pulse rounded bg-surface-2" />
              ) : (
                <>
                  <p className="mt-1 text-xl font-semibold text-ivory">{data?.bat_first_win_pct.toFixed(0)}%</p>
                  <p className="text-xs text-fg-faint">win rate · chosen {data?.bat_first_chosen_pct.toFixed(0)}% of the time</p>
                </>
              )}
            </div>
            <div className="rounded-xl border border-line-strong p-3">
              <p className="text-xs font-medium uppercase tracking-widest text-fg-faint">Elect to Bowl</p>
              {isLoading ? (
                <div className="mt-2 h-6 w-16 animate-pulse rounded bg-surface-2" />
              ) : (
                <>
                  <p className="mt-1 text-xl font-semibold text-ivory">{data?.bowl_first_win_pct.toFixed(0)}%</p>
                  <p className="text-xs text-fg-faint">win rate · chosen {data?.bowl_first_chosen_pct.toFixed(0)}% of the time</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
