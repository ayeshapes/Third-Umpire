"use client";

/**
 * Ticket 7.1 -- Advanced KPIs.
 *
 * Batting-specific rate stats (average/strike rate/boundary%/dot
 * ball%) that only make sense once you're looking at batting
 * performance specifically -- distinct from the season-wide counting
 * stats in <SeasonOverviewCards>. Same data flow: one useChartData
 * call scoped by whatever's in the global filter bar.
 */

import { useChartData } from "@/hooks/use-chart-data";
import { StatCard, StatCardGrid } from "./stat-card";

export interface BattingKpis {
  batting_average: number | null;
  strike_rate: number;
  boundary_percent: number;
  /** % of balls faced that were dots. */
  dot_ball_percent: number;
  balls_per_boundary: number | null;
  fours: number;
  sixes: number;
  /** Runs scored per 100 balls in the powerplay specifically. */
  powerplay_strike_rate: number | null;
}

export function BattingKpiCards() {
  const { data, isLoading, isError, error, refetch } = useChartData<BattingKpis>(
    "/api/analytics/batting/kpis"
  );

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-crimson-bright/40 bg-surface px-4 py-3 text-xs text-crimson-bright">
        <span>{error instanceof Error ? error.message : "Failed to load batting KPIs"}</span>
        <button type="button" onClick={() => refetch()} className="shrink-0 font-medium underline underline-offset-2">
          Retry
        </button>
      </div>
    );
  }

  return (
    <StatCardGrid>
      <StatCard
        label="Batting Average"
        value={data ? (data.batting_average != null ? data.batting_average.toFixed(2) : "--") : undefined}
        isLoading={isLoading}
      />
      <StatCard label="Strike Rate" value={data ? data.strike_rate.toFixed(1) : undefined} isLoading={isLoading} />
      <StatCard
        label="Boundary %"
        value={data ? `${data.boundary_percent.toFixed(1)}%` : undefined}
        sublabel={data ? `${data.fours} fours · ${data.sixes} sixes` : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="Dot Ball %"
        value={data ? `${data.dot_ball_percent.toFixed(1)}%` : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="Balls / Boundary"
        value={data ? (data.balls_per_boundary != null ? data.balls_per_boundary.toFixed(1) : "--") : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="Powerplay SR"
        value={
          data ? (data.powerplay_strike_rate != null ? data.powerplay_strike_rate.toFixed(1) : "--") : undefined
        }
        isLoading={isLoading}
      />
    </StatCardGrid>
  );
}
