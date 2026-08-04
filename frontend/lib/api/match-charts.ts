/**
 * Match Insights page -- Worm/Manhattan/Run Rate/Partnership Timeline/
 * Match Timeline/Match Highlights data.
 *
 * Repoint fix for six sections that were all pointed at separate
 * illustrative placeholder paths (`/api/matches/worm`, `/api/matches/
 * manhattan`, `/api/matches/run-rate-comparison`, `/api/matches/
 * partnership-timeline`, `/api/matches/timeline`, `/api/matches/
 * highlights`) that don't exist: none of them needed a new endpoint.
 * `/api/matches/{match_id}/detail` (lib/api/match-detail.ts) already
 * returns everything -- worm points, scorecards, fall of wickets,
 * partnerships, boundaries -- per innings. These functions just slice
 * and reshape that one payload six different ways, so the whole page
 * shares one fetch (see hooks/use-match-detail-charts.ts) instead of
 * six.
 *
 * The only backend change this needed was adding two things the
 * `/detail` endpoint's existing queries didn't select yet, even
 * though the data was already there: `start_over`/`end_over` on
 * partnerships (columns already on the table, just not in the
 * SELECT), and a small boundaries query (fours/sixes) alongside the
 * wickets query that endpoint already had. Both are in
 * backend/app/routers/matches.py now.
 *
 * Turning Points / Momentum Changes (Match Highlights) are the one
 * place this is a heuristic rather than a direct reshape: the backend
 * doesn't compute "why a moment mattered," so these are derived here
 * from wicket clusters (2+ wickets in a 3-over window) and high-
 * scoring partnership stretches (10+ RPO). That's a real simplification,
 * not a model -- flagged in the UI copy below rather than presented as
 * more authoritative than it is.
 */

import type { RawMatchDetail, RawInnings, RawFallOfWicket, RawPartnership } from "./match-detail";
import type { WormGraphData } from "@/components/charts/worm-graph";
import type { ManhattanOver } from "@/components/charts/manhattan-chart";
import type { RunRateComparisonData, RunRatePoint } from "@/components/charts/run-rate-comparison";
import type { PartnershipTimelineData } from "@/components/charts/partnership-timeline";
import type { MatchTimelineData, TimelineEvent } from "@/components/match/match-timeline";
import type { MatchHighlightsData, TurningPoint, MomentumChange } from "@/components/match/match-highlights";

// PSL is a T20 competition -- not returned by the backend anywhere, so
// this is the one genuinely hardcoded assumption in these mappers.
const T20_OVERS = 20;

function inningsFor(raw: RawMatchDetail, teamId: number | undefined): RawInnings | undefined {
  return raw.innings.find((i) => i.batting_team_id === teamId);
}

export function toWormGraph(raw: RawMatchDetail): WormGraphData | null {
  const m = raw.match;
  if (!m) return null;
  const inn1 = inningsFor(raw, m.team1_id);
  const inn2 = inningsFor(raw, m.team2_id);
  if (!inn1 && !inn2) return null;

  const overs = Array.from({ length: T20_OVERS }, (_, i) => i + 1);
  const cumAt = (innings: RawInnings | undefined, over: number) => {
    if (!innings) return 0;
    const point = [...innings.worm].reverse().find((p) => p.over_number <= over);
    return point?.cumulative_runs ?? 0;
  };

  return {
    team1_name: m.team1_name,
    team2_name: m.team2_name,
    points: overs.map((over) => ({
      over,
      team1_cumulative: cumAt(inn1, over),
      team2_cumulative: cumAt(inn2, over),
    })),
  };
}

/** One innings' Manhattan bars -- the component only renders one series, so the page calls this once per innings. */
export function toManhattan(innings: RawInnings | undefined): ManhattanOver[] {
  if (!innings) return [];
  return innings.worm.map((p) => ({ over: p.over_number, runs: p.runs_conceded, wickets: p.wickets }));
}

export function toRunRateComparison(raw: RawMatchDetail): RunRateComparisonData | null {
  const m = raw.match;
  if (!m) return null;
  const inn1 = inningsFor(raw, m.team1_id);
  const inn2 = inningsFor(raw, m.team2_id);
  if (!inn1) return null;

  const target = inn1.total_runs + 1;
  const inn2ByOver = new Map(inn2?.worm.map((p) => [p.over_number, p]) ?? []);

  const points: RunRatePoint[] = inn1.worm.map((p1) => {
    const p2 = inn2ByOver.get(p1.over_number);
    let requiredRate: number | null = null;
    if (p2) {
      const remaining = target - p2.cumulative_runs;
      const oversLeft = T20_OVERS - p1.over_number;
      requiredRate = oversLeft > 0 && remaining > 0 ? remaining / oversLeft : null;
    }
    return {
      over: p1.over_number,
      team1_rate: p1.runs_conceded,
      team2_rate: p2 ? p2.runs_conceded : null,
      required_rate: requiredRate,
    };
  });

  return { team1_name: m.team1_name, team2_name: m.team2_name, points };
}

export function toPartnershipTimeline(raw: RawMatchDetail): PartnershipTimelineData | null {
  if (raw.innings.length === 0) return null;
  const entries = raw.innings.flatMap((innings) =>
    innings.partnerships
      .filter((p): p is RawPartnership & { start_over: number; end_over: number } => p.start_over != null && p.end_over != null)
      .map((p) => ({
        innings: innings.innings_number as 1 | 2,
        wicket: p.wicket_number,
        batter1: p.batter1_name ?? "Unknown",
        batter2: p.batter2_name ?? "Unknown",
        start_over: p.start_over,
        end_over: p.end_over,
        runs: p.runs,
      }))
  );
  return { innings_overs: T20_OVERS, entries };
}

export function toMatchTimeline(raw: RawMatchDetail): MatchTimelineData {
  const events: TimelineEvent[] = [];

  raw.innings.forEach((innings) => {
    const inn = innings.innings_number as 1 | 2;

    innings.boundaries.forEach((b) => {
      events.push({
        innings: inn,
        over: b.over_number + b.ball_number / 10,
        type: b.runs_batter === 6 ? "six" : "four",
        description: `${b.striker_name ?? "Batter"} hits a ${b.runs_batter}`,
      });
    });

    innings.fall_of_wickets.forEach((w) => {
      events.push({
        innings: inn,
        over: w.over_number + w.ball_number / 10,
        type: "wicket",
        description: `${w.dismissed_player_name ?? "Batter"} out${w.dismissal_type ? ` (${w.dismissal_type})` : ""} -- ${w.running_score}`,
      });
    });
  });

  if (raw.innings.length > 1) {
    events.push({
      innings: 2,
      over: 0,
      type: "innings_break",
      description: "Innings break",
    });
  }

  events.sort((a, b) => a.innings - b.innings || a.over - b.over);

  // NOTE: fifty/hundred milestones aren't included -- they'd need a
  // per-ball cumulative total per batter, which /detail doesn't return
  // (only the final scorecard tally). Left as a known gap rather than
  // guessed at.
  return { events };
}

function wicketClusters(fow: RawFallOfWicket[]): { over: number; count: number }[] {
  const clusters: { over: number; count: number }[] = [];
  for (let i = 0; i < fow.length; i++) {
    const windowEnd = fow[i].over_number + 3;
    const count = fow.filter((w) => w.over_number >= fow[i].over_number && w.over_number <= windowEnd).length;
    if (count >= 2) clusters.push({ over: fow[i].over_number, count });
  }
  return clusters;
}

export function toMatchHighlights(raw: RawMatchDetail): MatchHighlightsData | null {
  const m = raw.match;
  if (!m) return null;

  // Best partnership: largest by runs across both innings.
  const allPartnerships = raw.innings.flatMap((innings) =>
    innings.partnerships.map((p) => ({ ...p, innings: innings.innings_number as 1 | 2 }))
  );
  const bestP = allPartnerships.length
    ? allPartnerships.reduce((a, b) => (b.runs > a.runs ? b : a))
    : null;

  // Best bowling spell: most wickets, tie-broken by lowest economy.
  const allBowling = raw.innings.flatMap((innings) => innings.bowling);
  const bestB = allBowling.length
    ? allBowling.reduce((a, b) => {
        if (b.wickets !== a.wickets) return b.wickets > a.wickets ? b : a;
        return (b.economy ?? Infinity) < (a.economy ?? Infinity) ? b : a;
      })
    : null;

  // Turning points: wicket clusters (2+ wickets within a 3-over window) --
  // a simple heuristic, not a model. See file header.
  const turningPoints: TurningPoint[] = raw.innings.flatMap((innings) =>
    wicketClusters(innings.fall_of_wickets).map((c) => ({
      innings: innings.innings_number as 1 | 2,
      over: c.over,
      description: `${c.count} wickets fall in quick succession around over ${c.over}`,
    }))
  );

  // Momentum changes: partnerships scoring at 10+ runs/over -- another
  // heuristic, favoring the batting side of that innings.
  const momentumChanges: MomentumChange[] = raw.innings.flatMap((innings) => {
    const favored = innings.batting_team_id === m.team1_id ? "team1" : "team2";
    return innings.partnerships
      .filter((p) => p.start_over != null && p.end_over != null && p.end_over > p.start_over)
      .filter((p) => p.runs / ((p.end_over as number) - (p.start_over as number)) >= 10)
      .map((p) => ({
        innings: innings.innings_number as 1 | 2,
        over: p.end_over as number,
        description: `${p.batter1_name ?? "Batter"} & ${p.batter2_name ?? "Batter"} accelerate to ${p.runs} runs`,
        favored: favored as "team1" | "team2",
      }));
  });

  const matchFacts: string[] = [];
  if (bestP) matchFacts.push(`Highest partnership: ${bestP.batter1_name ?? "?"} & ${bestP.batter2_name ?? "?"} (${bestP.runs})`);
  if (bestB) matchFacts.push(`Best bowling: ${bestB.display_name ?? bestB.full_name} (${bestB.wickets}/${bestB.runs_conceded})`);
  const mostBoundaries = raw.innings
    .flatMap((i) => i.boundaries)
    .reduce<Record<string, number>>((acc, b) => {
      const key = b.striker_name ?? "Unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  const topBoundaryHitter = Object.entries(mostBoundaries).sort((a, b) => b[1] - a[1])[0];
  if (topBoundaryHitter) matchFacts.push(`Most boundaries: ${topBoundaryHitter[0]} (${topBoundaryHitter[1]})`);

  return {
    turning_points: turningPoints,
    best_partnership: bestP
      ? { batter1: bestP.batter1_name ?? "Unknown", batter2: bestP.batter2_name ?? "Unknown", wicket: bestP.wicket_number, runs: bestP.runs, balls: bestP.balls_faced }
      : null,
    best_bowling_spell: bestB
      ? { bowler: bestB.display_name ?? bestB.full_name, overs: bestB.overs_bowled, runs: bestB.runs_conceded, wickets: bestB.wickets }
      : null,
    momentum_changes: momentumChanges,
    match_facts: matchFacts,
  };
}
