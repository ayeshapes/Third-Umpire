"use client";

/**
 * Ticket 7.1 -- Season Overview.
 *
 * High-level "how much cricket happened" cards for whatever the
 * global filter bar currently scopes to (season/team/player/etc) --
 * matches played, runs scored league-wide, the headline individual
 * innings, and how many milestone innings (50s/100s) it produced.
 * Sits above the more batting-specific KPI row (see
 * batting-kpi-cards.tsx) since these numbers frame the whole season
 * before drilling into any one player's numbers.
 *
 * Wired the same way every other chart on this page is: useChartData
 * reads the shared filter store and refetches automatically on any
 * filter change -- nothing season-specific to wire up here beyond the
 * endpoint path and the response shape.
 */

import { useChartData } from "@/hooks/use-chart-data";
import { StatCard, StatCardGrid } from "./stat-card";

export interface SeasonOverviewStats {
  matches: number;
  total_runs: number;
  total_wickets: number;
  average_runs_per_match: number;
  highest_total: number;
  highest_total_team: string | null;
  highest_individual_score: number;
  highest_individual_scorer: string | null;
  centuries: number;
  half_centuries: number;
}

const numberFmt = new Intl.NumberFormat("en-US");

export function SeasonOverviewCards() {
  const { data, isLoading, isError, error, refetch } = useChartData<SeasonOverviewStats>(
    "/api/analytics/batting/season-overview"
  );

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-crimson-bright/40 bg-surface px-4 py-3 text-xs text-crimson-bright">
        <span>{error instanceof Error ? error.message : "Failed to load season overview"}</span>
        <button type="button" onClick={() => refetch()} className="shrink-0 font-medium underline underline-offset-2">
          Retry
        </button>
      </div>
    );
  }

  return (
    <StatCardGrid>
      <StatCard label="Matches" value={data ? numberFmt.format(data.matches) : undefined} isLoading={isLoading} />
      <StatCard
        label="Total Runs"
        value={data ? numberFmt.format(data.total_runs) : undefined}
        sublabel={data ? `${data.total_wickets} wickets` : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="Runs / Match"
        value={data ? data.average_runs_per_match.toFixed(1) : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="Highest Total"
        value={data ? numberFmt.format(data.highest_total) : undefined}
        sublabel={data?.highest_total_team ?? undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="Highest Score"
        value={data ? numberFmt.format(data.highest_individual_score) : undefined}
        sublabel={data?.highest_individual_scorer ?? undefined}
        isLoading={isLoading}
      />
      <StatCard label="Centuries" value={data ? numberFmt.format(data.centuries) : undefined} isLoading={isLoading} />
      <StatCard
        label="Half-Centuries"
        value={data ? numberFmt.format(data.half_centuries) : undefined}
        isLoading={isLoading}
      />
    </StatCardGrid>
  );
}
