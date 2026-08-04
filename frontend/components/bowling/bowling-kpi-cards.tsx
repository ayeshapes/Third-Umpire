"use client";

/**
 * Ticket 8.1 -- Advanced KPIs (bowling).
 *
 * Rate stats that only make sense once you're looking at bowling
 * performance specifically -- economy, bowling average/strike rate,
 * dot-ball %, and the powerplay-specific economy that a raw wickets
 * count can't tell you. Mirrors components/batting/batting-kpi-cards.tsx
 * one-for-one so the two pages read the same way.
 */

import { useChartData } from "@/hooks/use-chart-data";
import { StatCard, StatCardGrid } from "@/components/batting/stat-card";

export interface BowlingKpis {
  bowling_average: number | null;
  economy_rate: number;
  strike_rate: number | null; // balls per wicket
  dot_ball_percent: number;
  wickets: number;
  maidens: number;
  /** Economy rate in the powerplay specifically. */
  powerplay_economy: number | null;
}

export function BowlingKpiCards() {
  const { data, isLoading, isError, error, refetch } = useChartData<BowlingKpis>(
    "/api/analytics/bowling/kpis"
  );

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-crimson-bright/40 bg-surface px-4 py-3 text-xs text-crimson-bright">
        <span>{error instanceof Error ? error.message : "Failed to load bowling KPIs"}</span>
        <button type="button" onClick={() => refetch()} className="shrink-0 font-medium underline underline-offset-2">
          Retry
        </button>
      </div>
    );
  }

  return (
    <StatCardGrid>
      <StatCard
        label="Bowling Average"
        value={data ? (data.bowling_average != null ? data.bowling_average.toFixed(2) : "--") : undefined}
        isLoading={isLoading}
      />
      <StatCard label="Economy Rate" value={data ? data.economy_rate.toFixed(2) : undefined} isLoading={isLoading} />
      <StatCard
        label="Strike Rate"
        value={data ? (data.strike_rate != null ? data.strike_rate.toFixed(1) : "--") : undefined}
        sublabel="balls / wicket"
        isLoading={isLoading}
      />
      <StatCard
        label="Dot Ball %"
        value={data ? `${data.dot_ball_percent.toFixed(1)}%` : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="Wickets"
        value={data ? data.wickets : undefined}
        sublabel={data ? `${data.maidens} maidens` : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="Powerplay Economy"
        value={data ? (data.powerplay_economy != null ? data.powerplay_economy.toFixed(2) : "--") : undefined}
        isLoading={isLoading}
      />
    </StatCardGrid>
  );
}
