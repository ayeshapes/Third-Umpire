"use client";

/**
 * Team Comparison Studio: Team Insights.
 *
 * Renders lib/team-insights.ts's derived read of the comparison: a
 * plain-language summary up top, then Strengths / Weaknesses /
 * Historical Trends / Interesting Observations underneath. Calls
 * useTeamComparison with the *same* battingPath/bowlingPath/
 * historyPath the page's own <BattingComparison>, <BowlingComparison>,
 * and <HistoricalPerformance> use -- same query keys, so this reuses
 * those cached responses instead of firing three more requests.
 */

import { useMemo } from "react";
import { useTeamComparison } from "@/hooks/use-team-comparison";
import { buildTeamComparisonInsights, type TeamInsight, type TeamInsightKind } from "@/lib/team-insights";
import type { TeamBattingComparisonData, TeamBowlingComparisonData } from "./types";
import type { HistoricalPerformanceData } from "./historical-performance";

const KIND_LABELS: Record<TeamInsightKind, string> = {
  strength: "Team Strengths",
  weakness: "Weaknesses",
  trend: "Historical Trends",
  observation: "Interesting Comparison Insights",
};

const KIND_ACCENTS: Record<TeamInsightKind, string> = {
  strength: "border-l-crimson-bright",
  weakness: "border-l-fg-muted",
  trend: "border-l-ivory",
  observation: "border-l-line-strong",
};

function InsightGroup({ kind, insights }: { kind: TeamInsightKind; insights: TeamInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-fg-faint">{KIND_LABELS[kind]}</p>
      <ul className="flex flex-col gap-2">
        {insights.map((insight, i) => (
          <li key={i} className={`rounded-r-lg border-l-2 bg-surface-2 px-3 py-2 text-sm text-fg-muted ${KIND_ACCENTS[kind]}`}>
            {insight.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface TeamComparisonInsightsProps {
  battingPath: string;
  bowlingPath: string;
  historyPath: string;
  teamAId: number | null;
  teamBId: number | null;
}

export function TeamComparisonInsights({ battingPath, bowlingPath, historyPath, teamAId, teamBId }: TeamComparisonInsightsProps) {
  const batting = useTeamComparison<TeamBattingComparisonData>(battingPath, teamAId, teamBId);
  const bowling = useTeamComparison<TeamBowlingComparisonData>(bowlingPath, teamAId, teamBId);
  const history = useTeamComparison<HistoricalPerformanceData>(historyPath, teamAId, teamBId);

  const isLoading = batting.isLoading || bowling.isLoading || history.isLoading;
  const isFetching = batting.isFetching || bowling.isFetching || history.isFetching;
  const isError = batting.isError || bowling.isError || history.isError;
  const error = batting.error ?? bowling.error ?? history.error;
  const data = batting.data && bowling.data && history.data ? { batting: batting.data, bowling: bowling.data, history: history.data } : null;

  function retry() {
    batting.refetch();
    bowling.refetch();
    history.refetch();
  }

  const insights = useMemo(
    () => (data ? buildTeamComparisonInsights(data.batting, data.bowling, data.history) : null),
    [data]
  );

  if (teamAId === null || teamBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two teams above to generate comparison insights.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Team Insights</h3>
        {isFetching && !isLoading && <span className="text-xs text-fg-faint">Updating…</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading insights" className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-xs text-crimson-bright">
          <span className="text-center">{error instanceof Error ? error.message : "Failed to load comparison data"}</span>
          <button type="button" onClick={retry} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || !insights ? (
        <div className="flex h-32 items-center justify-center text-xs text-fg-faint">No data available to generate insights</div>
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-ivory">{insights.summary}</p>
          <InsightGroup kind="strength" insights={insights.strengths} />
          <InsightGroup kind="weakness" insights={insights.weaknesses} />
          <InsightGroup kind="trend" insights={insights.trends} />
          <InsightGroup kind="observation" insights={insights.observations} />
          {insights.strengths.length === 0 &&
            insights.weaknesses.length === 0 &&
            insights.trends.length === 0 &&
            insights.observations.length === 0 && (
              <p className="text-xs text-fg-faint">Nothing stood out beyond the summary above for this pair.</p>
            )}
        </div>
      )}
    </div>
  );
}
