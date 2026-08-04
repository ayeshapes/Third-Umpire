/**
 * Ticket 12.2 -- Player Insights.
 *
 * Pure, framework-agnostic derivation of comparison insights from
 * career stats already on the page -- deliberately *not* its own
 * fetched endpoint. The alternative (an `/api/players/compare/
 * insights` route returning pre-written sentences) would let the
 * insight text and the numbers in <CareerStatsComparison> drift out
 * of sync, and duplicates a request the page has already made:
 * components/players/comparison-insights.tsx shares
 * hooks/use-player-career-compare.ts's `usePlayerCareerCompare`
 * query with <CareerStatsComparison> (same query key), so React
 * Query serves both from one cached response (same reasoning as
 * hooks/use-chart-data.ts's dedup) and this module turns that one
 * response into prose.
 *
 * Kept out of the component file so the insight rules are
 * independently readable/testable without any React involved.
 */

import { COMPARISON_METRICS, type PlayerCareerComparisonData, type ComparisonMetric } from "@/components/players/types";

export type InsightKind = "strength" | "difference" | "observation";

export interface Insight {
  kind: InsightKind;
  text: string;
}

/** How far apart two values need to be (as a fraction of the larger) before a lead is worth calling out. */
const NOTABLE_GAP_FRACTION = 0.12;

function fractionalGap(a: number, b: number): number {
  const larger = Math.max(Math.abs(a), Math.abs(b));
  if (larger === 0) return 0;
  return Math.abs(a - b) / larger;
}

function nameFor(data: PlayerCareerComparisonData, side: "a" | "b"): string {
  const p = side === "a" ? data.player_a : data.player_b;
  return p.display_name ?? p.full_name;
}

/** Strength highlights: metrics with a sample-size-qualified, non-trivial lead for one player. */
function strengthInsights(data: PlayerCareerComparisonData): Insight[] {
  const insights: Insight[] = [];

  for (const metric of COMPARISON_METRICS) {
    const aValue = data.player_a.stats[metric.key];
    const bValue = data.player_b.stats[metric.key];
    if (typeof aValue !== "number" || typeof bValue !== "number") continue;

    const minSample = metric.minSampleForInsight ?? 0;
    if (data.player_a.stats.matches < minSample || data.player_b.stats.matches < minSample) continue;
    if (fractionalGap(aValue, bValue) < NOTABLE_GAP_FRACTION) continue;

    const aLeads = metric.higherIsBetter ? aValue > bValue : aValue < bValue;
    const leaderName = nameFor(data, aLeads ? "a" : "b");
    const leaderValue = aLeads ? aValue : bValue;
    const otherValue = aLeads ? bValue : aValue;

    insights.push({
      kind: "strength",
      text: `${leaderName} holds the edge in ${metric.label.toLowerCase()}: ${metric.format(leaderValue)} vs ${metric.format(otherValue)}.`,
    });
  }

  return insights;
}

/** Performance differences: broader-scope comparisons (experience, role balance) beyond single-stat leads. */
function differenceInsights(data: PlayerCareerComparisonData): Insight[] {
  const insights: Insight[] = [];
  const a = data.player_a.stats;
  const b = data.player_b.stats;

  const matchGap = fractionalGap(a.matches, b.matches);
  if (matchGap > 0.3 && Math.min(a.matches, b.matches) > 0) {
    const moreExperienced = a.matches > b.matches ? nameFor(data, "a") : nameFor(data, "b");
    const gapCount = Math.abs(a.matches - b.matches);
    insights.push({
      kind: "difference",
      text: `${moreExperienced} has played ${gapCount} more career matches, so their averages rest on a deeper sample.`,
    });
  }

  const aIsAllrounder = a.runs > 500 && a.wickets > 20;
  const bIsAllrounder = b.runs > 500 && b.wickets > 20;
  if (aIsAllrounder !== bIsAllrounder) {
    const allrounder = aIsAllrounder ? nameFor(data, "a") : nameFor(data, "b");
    const specialist = aIsAllrounder ? nameFor(data, "b") : nameFor(data, "a");
    insights.push({
      kind: "difference",
      text: `${allrounder} contributes meaningfully with both bat and ball, while ${specialist}'s value is concentrated in one discipline.`,
    });
  }

  return insights;
}

/** Interesting statistical observations: notable single-number facts that don't fit the "who's ahead" framing. */
function observationInsights(data: PlayerCareerComparisonData): Insight[] {
  const insights: Insight[] = [];
  const a = data.player_a.stats;
  const b = data.player_b.stats;

  if (a.five_wicket_hauls > 0 || b.five_wicket_hauls > 0) {
    const total = a.five_wicket_hauls + b.five_wicket_hauls;
    insights.push({
      kind: "observation",
      text: `Between them, these two players have taken ${total} five-wicket haul${total === 1 ? "" : "s"}.`,
    });
  }

  const combinedCenturies = a.centuries + b.centuries;
  if (combinedCenturies >= 5) {
    insights.push({
      kind: "observation",
      text: `Combined, they've brought up ${combinedCenturies} centuries across their careers.`,
    });
  }

  return insights;
}

export interface ComparisonInsightsResult {
  strengths: Insight[];
  differences: Insight[];
  observations: Insight[];
  /** One-paragraph synthesis, built from the strongest signal available. */
  summary: string;
}

export function buildComparisonInsights(data: PlayerCareerComparisonData): ComparisonInsightsResult {
  const strengths = strengthInsights(data);
  const differences = differenceInsights(data);
  const observations = observationInsights(data);

  const aName = nameFor(data, "a");
  const bName = nameFor(data, "b");

  let summary: string;
  if (strengths.length === 0) {
    summary = `${aName} and ${bName} are closely matched across the metrics available -- no single stat separates them by a wide margin.`;
  } else {
    // Count leads per side to characterize the overall picture, not just list the first strength found.
    const aLeadCount = strengths.filter((s) => s.text.startsWith(aName)).length;
    const bLeadCount = strengths.length - aLeadCount;
    if (aLeadCount > 0 && bLeadCount > 0) {
      summary = `${aName} and ${bName} each bring distinct strengths -- ${aName} ahead on ${aLeadCount} tracked metric${aLeadCount === 1 ? "" : "s"}, ${bName} on ${bLeadCount}.`;
    } else {
      const leader = aLeadCount > 0 ? aName : bName;
      const other = aLeadCount > 0 ? bName : aName;
      summary = `${leader} leads across most of the metrics tracked here, though ${other} still holds up in the areas noted above.`;
    }
  }

  return { strengths, differences, observations, summary };
}

export const _internal = { fractionalGap, NOTABLE_GAP_FRACTION };
export type { ComparisonMetric };
