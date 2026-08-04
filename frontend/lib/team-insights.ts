/**
 * Team Comparison Studio -- Team Insights.
 *
 * Pure, framework-agnostic derivation of strengths/weaknesses/
 * historical trends/observations from data the page has *already*
 * fetched -- same reasoning as lib/player-insights.ts: no dedicated
 * `/api/teams/compare/insights` endpoint, so this text can never
 * drift out of sync with the numbers rendered in <BattingComparison>,
 * <BowlingComparison>, and <HistoricalPerformance>.
 * components/teams/comparison-insights.tsx calls useTeamComparison
 * with the *same* batting/bowling/history paths those components use,
 * so React Query serves all three from already-cached queries instead
 * of firing new requests.
 *
 * Strengths and weaknesses are two sides of the same computation: any
 * notable gap on a metric is a strength for whoever leads and a
 * weakness for whoever trails, so one pass over the metric list
 * produces both lists instead of two separate rule sets that could
 * disagree.
 */

import {
  BATTING_COMPARISON_METRICS,
  BOWLING_COMPARISON_METRICS,
  type TeamBattingComparisonData,
  type TeamBowlingComparisonData,
  type TeamComparisonMetric,
} from "@/components/teams/types";
import type { HistoricalPerformanceData, TeamSeasonPoint } from "@/components/teams/historical-performance";

export type TeamInsightKind = "strength" | "weakness" | "trend" | "observation";

export interface TeamInsight {
  kind: TeamInsightKind;
  text: string;
}

/** How far apart two values need to be (as a fraction of the larger) before a gap is worth calling out. */
const NOTABLE_GAP_FRACTION = 0.12;
/** How much a season average needs to move between "early" and "recent" windows to count as a trend. */
const NOTABLE_TREND_POINTS = 8;

function fractionalGap(a: number, b: number): number {
  const larger = Math.max(Math.abs(a), Math.abs(b));
  if (larger === 0) return 0;
  return Math.abs(a - b) / larger;
}

/** One pass over a metric list -- pushes a strength for the leader and a weakness for the trailer per notable gap. */
function strengthAndWeaknessInsights<T>(
  metrics: TeamComparisonMetric<T>[],
  statsA: T,
  statsB: T,
  codeA: string,
  codeB: string,
  disciplineLabel: string
): { strengths: TeamInsight[]; weaknesses: TeamInsight[] } {
  const strengths: TeamInsight[] = [];
  const weaknesses: TeamInsight[] = [];

  for (const metric of metrics) {
    const aValue = statsA[metric.key];
    const bValue = statsB[metric.key];
    if (typeof aValue !== "number" || typeof bValue !== "number") continue;
    if (fractionalGap(aValue, bValue) < NOTABLE_GAP_FRACTION) continue;

    const aLeads = metric.higherIsBetter ? aValue > bValue : aValue < bValue;
    const leaderCode = aLeads ? codeA : codeB;
    const trailerCode = aLeads ? codeB : codeA;
    const leaderValue = aLeads ? aValue : bValue;
    const trailerValue = aLeads ? bValue : aValue;

    strengths.push({
      kind: "strength",
      text: `${leaderCode}'s ${disciplineLabel} edge shows in ${metric.label.toLowerCase()}: ${metric.format(leaderValue)} vs ${metric.format(trailerValue)}.`,
    });
    weaknesses.push({
      kind: "weakness",
      text: `${trailerCode} lags in ${metric.label.toLowerCase()} (${disciplineLabel}): ${metric.format(trailerValue)} vs ${leaderCode}'s ${metric.format(leaderValue)}.`,
    });
  }

  return { strengths, weaknesses };
}

/** Compares an early window of seasons against a recent one to spot a team trending up or down. */
function trendInsights(history: HistoricalPerformanceData): TeamInsight[] {
  const insights: TeamInsight[] = [];
  const sorted = [...history.points].sort((a, b) => a.season_year - b.season_year);
  if (sorted.length < 4) return insights;

  const windowSize = Math.max(Math.floor(sorted.length / 2), 1);
  const early = sorted.slice(0, windowSize);
  const recent = sorted.slice(-windowSize);

  const avg = (points: TeamSeasonPoint[], key: "team_a_win_pct" | "team_b_win_pct") =>
    points.reduce((sum, p) => sum + p[key], 0) / points.length;

  (
    [
      ["team_a_win_pct", history.team_a_code],
      ["team_b_win_pct", history.team_b_code],
    ] as const
  ).forEach(([key, code]) => {
    const earlyAvg = avg(early, key);
    const recentAvg = avg(recent, key);
    const delta = recentAvg - earlyAvg;
    if (Math.abs(delta) < NOTABLE_TREND_POINTS) return;

    const direction = delta > 0 ? "climbed" : "declined";
    insights.push({
      kind: "trend",
      text: `${code}'s win rate has ${direction} from ${earlyAvg.toFixed(0)}% to ${recentAvg.toFixed(0)}% comparing earlier to more recent seasons.`,
    });
  });

  const lastSeason = sorted[sorted.length - 1];
  const aRecentlyBetter = lastSeason.team_a_win_pct > lastSeason.team_b_win_pct;
  insights.push({
    kind: "trend",
    text: `In the most recent season on record (${lastSeason.season_year}), ${
      aRecentlyBetter ? history.team_a_code : history.team_b_code
    } posted the better win rate (${(aRecentlyBetter ? lastSeason.team_a_win_pct : lastSeason.team_b_win_pct).toFixed(0)}%).`,
  });

  return insights;
}

/** Cross-cutting facts that don't fit the "who's ahead" framing -- combined totals, notable milestones. */
function observationInsights(batting: TeamBattingComparisonData, bowling: TeamBowlingComparisonData): TeamInsight[] {
  const insights: TeamInsight[] = [];

  const combined5fers = bowling.team_a.stats.five_wicket_hauls + bowling.team_b.stats.five_wicket_hauls;
  if (combined5fers > 0) {
    insights.push({
      kind: "observation",
      text: `Between them, these two sides have recorded ${combined5fers} five-wicket haul${combined5fers === 1 ? "" : "s"}.`,
    });
  }

  const combined200s = batting.team_a.stats.scores_200_plus + batting.team_b.stats.scores_200_plus;
  if (combined200s > 0) {
    insights.push({
      kind: "observation",
      text: `Combined, they've posted ${combined200s} score${combined200s === 1 ? "" : "s"} of 200 or more.`,
    });
  }

  const combinedSixes = batting.team_a.stats.sixes + batting.team_b.stats.sixes;
  if (combinedSixes > 0) {
    insights.push({
      kind: "observation",
      text: `${combinedSixes} sixes have been struck between them across the matches on record.`,
    });
  }

  return insights;
}

export interface TeamComparisonInsightsResult {
  strengths: TeamInsight[];
  weaknesses: TeamInsight[];
  trends: TeamInsight[];
  observations: TeamInsight[];
  /** One-paragraph synthesis, built from the strongest signal available. */
  summary: string;
}

export function buildTeamComparisonInsights(
  batting: TeamBattingComparisonData,
  bowling: TeamBowlingComparisonData,
  history: HistoricalPerformanceData
): TeamComparisonInsightsResult {
  const codeA = batting.team_a.team_code;
  const codeB = batting.team_b.team_code;

  const battingSplit = strengthAndWeaknessInsights(
    BATTING_COMPARISON_METRICS,
    batting.team_a.stats,
    batting.team_b.stats,
    codeA,
    codeB,
    "batting"
  );
  const bowlingSplit = strengthAndWeaknessInsights(
    BOWLING_COMPARISON_METRICS,
    bowling.team_a.stats,
    bowling.team_b.stats,
    codeA,
    codeB,
    "bowling"
  );

  const strengths = [...battingSplit.strengths, ...bowlingSplit.strengths];
  const weaknesses = [...battingSplit.weaknesses, ...bowlingSplit.weaknesses];
  const trends = trendInsights(history);
  const observations = observationInsights(batting, bowling);

  let summary: string;
  if (strengths.length === 0) {
    summary = `${codeA} and ${codeB} are closely matched across the tracked batting and bowling metrics -- no single stat separates them by a wide margin.`;
  } else {
    const aLeadCount = strengths.filter((s) => s.text.startsWith(codeA)).length;
    const bLeadCount = strengths.length - aLeadCount;
    if (aLeadCount > 0 && bLeadCount > 0) {
      summary = `${codeA} and ${codeB} each bring distinct strengths -- ${codeA} ahead on ${aLeadCount} tracked metric${aLeadCount === 1 ? "" : "s"}, ${codeB} on ${bLeadCount}.`;
    } else {
      const leader = aLeadCount > 0 ? codeA : codeB;
      const other = aLeadCount > 0 ? codeB : codeA;
      summary = `${leader} leads across most of the batting and bowling metrics tracked here, though ${other} still holds up in the areas noted below.`;
    }
  }

  return { strengths, weaknesses, trends, observations, summary };
}
