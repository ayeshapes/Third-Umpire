"use client";

/**
 * Ticket 8.1 -- Bowling Overview.
 *
 * "How much bowling happened" for the current filter scope -- the
 * bowling-side mirror of <SeasonOverviewCards> on the batting page
 * (components/batting/season-overview-cards.tsx): matches/wickets
 * counting stats and the headline spell, rather than rate stats
 * (those live in <BowlingKpiCards> below, same split as batting).
 * Reuses the shared <StatCard>/<StatCardGrid> building block so both
 * pages' card grids stay visually and behaviourally identical.
 */

import { useChartData } from "@/hooks/use-chart-data";
import { StatCard, StatCardGrid } from "@/components/batting/stat-card";

export interface BowlingOverviewStats {
  matches: number;
  total_wickets: number;
  total_overs: number;
  average_wickets_per_match: number;
  best_figures: string; // e.g. "5/17"
  best_figures_bowler: string | null;
  five_wicket_hauls: number;
  maidens: number;
}

const numberFmt = new Intl.NumberFormat("en-US");

export function BowlingOverviewCards() {
  const { data, isLoading, isError, error, refetch } = useChartData<BowlingOverviewStats>(
    "/api/analytics/bowling/season-overview"
  );

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-crimson-bright/40 bg-surface px-4 py-3 text-xs text-crimson-bright">
        <span>{error instanceof Error ? error.message : "Failed to load bowling overview"}</span>
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
        label="Total Wickets"
        value={data ? numberFmt.format(data.total_wickets) : undefined}
        sublabel={data ? `${numberFmt.format(data.total_overs)} overs bowled` : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="Wickets / Match"
        value={data ? data.average_wickets_per_match.toFixed(1) : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="Best Figures"
        value={data ? data.best_figures : undefined}
        sublabel={data?.best_figures_bowler ?? undefined}
        isLoading={isLoading}
      />
      <StatCard label="5-Wicket Hauls" value={data ? numberFmt.format(data.five_wicket_hauls) : undefined} isLoading={isLoading} />
      <StatCard label="Maidens" value={data ? numberFmt.format(data.maidens) : undefined} isLoading={isLoading} />
    </StatCardGrid>
  );
}
