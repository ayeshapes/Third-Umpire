"use client";

/**
 * Ticket 12.2 -- Player Insights.
 *
 * Renders lib/player-insights.ts's derived read of the comparison:
 * a plain-language summary up top, then Strengths / Differences /
 * Observations underneath.
 *
 * Repoint fix: this used to call usePlayerComparison("/api/players/
 * compare/career-stats", ...) -- a path that was never real (see
 * lib/api/player-compare.ts's own doc comment; the actual backend
 * route is /api/players/compare, already repointed for
 * <CareerStatsComparison> via usePlayerCareerCompare). Reusing that
 * same hook here means React Query serves both from one cached
 * query (same `["players-compare", playerAId, playerBId]` key, same
 * dedup reasoning as hooks/use-chart-data.ts) instead of firing a
 * second, 404ing request -- which is what this component's docstring
 * always claimed happened, just not what the code before this fix
 * actually did.
 */

import { useMemo } from "react";
import { usePlayerCareerCompare } from "@/hooks/use-player-career-compare";
import { toCareerStats } from "@/lib/api/player-compare";
import { buildComparisonInsights, type Insight, type InsightKind } from "@/lib/player-insights";

const KIND_LABELS: Record<InsightKind, string> = {
  strength: "Strengths",
  difference: "Performance Differences",
  observation: "Statistical Observations",
};

const KIND_ACCENTS: Record<InsightKind, string> = {
  strength: "border-l-crimson-bright",
  difference: "border-l-fg-muted",
  observation: "border-l-line-strong",
};

function InsightGroup({ kind, insights }: { kind: InsightKind; insights: Insight[] }) {
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

export interface ComparisonInsightsProps {
  playerAId: number | null;
  playerBId: number | null;
}

export function ComparisonInsights({ playerAId, playerBId }: ComparisonInsightsProps) {
  const { data: raw, isLoading, isError, error, refetch, isFetching } = usePlayerCareerCompare(playerAId, playerBId);
  const data = useMemo(() => (raw ? toCareerStats(raw) : null), [raw]);
  const insights = useMemo(() => (data ? buildComparisonInsights(data) : null), [data]);

  if (playerAId === null || playerBId === null) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line-strong bg-surface px-6 py-12 text-center text-xs text-fg-faint">
        Pick two players above to generate comparison insights.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-strong bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Player Insights</h3>
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
          <button type="button" onClick={() => refetch()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : !data || !insights ? (
        <div className="flex h-32 items-center justify-center text-xs text-fg-faint">No data available to generate insights</div>
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity duration-150 ${isFetching ? "opacity-50" : "opacity-100"}`}>
          <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-ivory">{insights.summary}</p>
          <InsightGroup kind="strength" insights={insights.strengths} />
          <InsightGroup kind="difference" insights={insights.differences} />
          <InsightGroup kind="observation" insights={insights.observations} />
          {insights.strengths.length === 0 && insights.differences.length === 0 && insights.observations.length === 0 && (
            <p className="text-xs text-fg-faint">Nothing stood out beyond the summary above for this pair.</p>
          )}
        </div>
      )}
    </div>
  );
}
