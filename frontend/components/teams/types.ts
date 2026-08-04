/**
 * Shared Team Comparison Studio types.
 *
 * Same reasoning as components/players/types.ts: one canonical stat
 * shape per discipline, reused by its table *and* the radar chart (a
 * normalized subset of these fields) so nothing can drift out of
 * sync about what a given metric means or which direction is "better".
 *
 * Batting and bowling are split into two records (TeamBattingStats /
 * TeamBowlingStats) rather than one combined one -- unlike a player,
 * a team doesn't have a "primary discipline" to fall back on, and the
 * brief calls out Batting Comparison and Bowling Comparison as
 * separate sections, each with its own focused table rather than one
 * long grouped one.
 */

export interface TeamLite {
  team_id: number;
  team_name: string;
  team_code: string;
}

export interface TeamBattingStats {
  matches: number;
  innings: number;
  runs: number;
  avg_score: number | null;
  run_rate: number | null;
  highest_total: number | null;
  lowest_total: number | null;
  fours: number;
  sixes: number;
  powerplay_run_rate: number | null;
  death_overs_run_rate: number | null;
  /** Innings of 200+ -- a coarse "explosive top-order" signal. */
  scores_200_plus: number;
}

export interface TeamBowlingStats {
  matches: number;
  innings: number;
  wickets: number;
  bowling_average: number | null;
  economy_rate: number | null;
  bowling_strike_rate: number | null;
  best_bowling_figures: string | null; // e.g. "6/16", pre-formatted server-side
  dot_ball_pct: number | null;
  powerplay_economy: number | null;
  death_overs_economy: number | null;
  five_wicket_hauls: number;
}

export interface TeamBattingComparisonData {
  team_a: TeamLite & { stats: TeamBattingStats };
  team_b: TeamLite & { stats: TeamBattingStats };
}

export interface TeamBowlingComparisonData {
  team_a: TeamLite & { stats: TeamBowlingStats };
  team_b: TeamLite & { stats: TeamBowlingStats };
}

/** A single row of a comparison table -- one stat, both teams' values, and how to read it. */
export interface TeamComparisonMetric<T> {
  key: keyof T;
  label: string;
  format: (value: number | string | null) => string;
  /** false for stats where lower is better (economy, bowling average) -- controls the table's highlight. */
  higherIsBetter: boolean;
}

const dash = (v: number | string | null, fmt: (v: number | string) => string) => (v === null || v === undefined ? "--" : fmt(v));
const int = (v: number | string | null) => dash(v, String);
const fixed = (places: number) => (v: number | string | null) => dash(v, (n) => Number(n).toFixed(places));
const pct = (v: number | string | null) => dash(v, (n) => `${Number(n).toFixed(1)}%`);

export const BATTING_COMPARISON_METRICS: TeamComparisonMetric<TeamBattingStats>[] = [
  { key: "matches", label: "Matches", format: int, higherIsBetter: true },
  { key: "runs", label: "Total Runs", format: int, higherIsBetter: true },
  { key: "avg_score", label: "Average Score", format: fixed(1), higherIsBetter: true },
  { key: "run_rate", label: "Run Rate", format: fixed(2), higherIsBetter: true },
  { key: "highest_total", label: "Highest Total", format: int, higherIsBetter: true },
  { key: "lowest_total", label: "Lowest Total", format: int, higherIsBetter: false },
  { key: "fours", label: "4s", format: int, higherIsBetter: true },
  { key: "sixes", label: "6s", format: int, higherIsBetter: true },
  { key: "powerplay_run_rate", label: "Powerplay Run Rate", format: fixed(2), higherIsBetter: true },
  { key: "death_overs_run_rate", label: "Death Overs Run Rate", format: fixed(2), higherIsBetter: true },
  { key: "scores_200_plus", label: "200+ Scores", format: int, higherIsBetter: true },
];

export const BOWLING_COMPARISON_METRICS: TeamComparisonMetric<TeamBowlingStats>[] = [
  { key: "matches", label: "Matches", format: int, higherIsBetter: true },
  { key: "wickets", label: "Total Wickets", format: int, higherIsBetter: true },
  { key: "bowling_average", label: "Bowling Average", format: fixed(2), higherIsBetter: false },
  { key: "economy_rate", label: "Economy Rate", format: fixed(2), higherIsBetter: false },
  { key: "bowling_strike_rate", label: "Bowling Strike Rate", format: fixed(1), higherIsBetter: false },
  { key: "best_bowling_figures", label: "Best Bowling", format: int, higherIsBetter: true },
  { key: "dot_ball_pct", label: "Dot Ball %", format: pct, higherIsBetter: true },
  { key: "powerplay_economy", label: "Powerplay Economy", format: fixed(2), higherIsBetter: false },
  { key: "death_overs_economy", label: "Death Overs Economy", format: fixed(2), higherIsBetter: false },
  { key: "five_wicket_hauls", label: "5-Wicket Hauls", format: int, higherIsBetter: true },
];
