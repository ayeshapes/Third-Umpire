"use client";

/**
 * Ticket 10.1 -- Average Scores.
 *
 * The "par score" read for this venue: what batting first vs chasing
 * has actually scored and won at, plus the record highs/lows for
 * context. Deliberately separate from <BattingConditions> (which is
 * about *how* runs come, phase by phase) -- this is the single
 * number a captain winning the toss actually wants: "what should we
 * be aiming for / defending here."
 */

import { useChartData } from "@/hooks/use-chart-data";
import { StatCard, StatCardGrid } from "@/components/batting/stat-card";

export interface AverageScoresData {
  avg_batting_first_score: number;
  avg_chasing_score: number;
  win_batting_first_pct: number;
  win_chasing_pct: number;
  highest_total: number;
  highest_total_team: string | null;
  lowest_total: number;
  lowest_total_team: string | null;
}

export interface AverageScoresProps {
  path: string;
}

export function AverageScores({ path }: AverageScoresProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useChartData<AverageScoresData>(path);

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Average Scores</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isError ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load scoring data"}</span>
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : (
        <div className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <StatCardGrid>
            <StatCard
              label="Avg Batting First"
              value={data ? data.avg_batting_first_score.toFixed(0) : undefined}
              sublabel={data ? `Wins ${data.win_batting_first_pct.toFixed(0)}% of the time` : undefined}
              isLoading={isLoading}
            />
            <StatCard
              label="Avg Chasing"
              value={data ? data.avg_chasing_score.toFixed(0) : undefined}
              sublabel={data ? `Wins ${data.win_chasing_pct.toFixed(0)}% of the time` : undefined}
              isLoading={isLoading}
            />
            <StatCard
              label="Highest Total"
              value={data ? data.highest_total : undefined}
              sublabel={data?.highest_total_team ?? undefined}
              isLoading={isLoading}
            />
            <StatCard
              label="Lowest Total"
              value={data ? data.lowest_total : undefined}
              sublabel={data?.lowest_total_team ?? undefined}
              isLoading={isLoading}
            />
          </StatCardGrid>
        </div>
      )}
    </div>
  );
}
