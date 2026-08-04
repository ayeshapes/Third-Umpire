/**
 * Ticket 12.1/12.2 -- shared Player Comparison Studio types.
 *
 * One canonical `PlayerCareerStats` shape, reused by the stats table,
 * the radar chart (normalized off a subset of these fields) and the
 * insights engine (lib/player-insights.ts) -- same reasoning as
 * components/records/types.ts: pulling the shape out here means no
 * component owns the canonical definition and insights can't drift
 * out of sync with what the table actually renders.
 *
 * Batting and bowling stats both live on one record rather than two
 * separate "role" records -- most players who show up in a head-to-
 * head comparison have at least a handful of overs or innings on the
 * side that isn't their primary discipline, and collapsing to
 * "batters compare batting, bowlers compare bowling" would silently
 * drop that. Fields that don't apply for a given player just come
 * back null and every consumer already has to handle null (see
 * `formatStat` below).
 */

export interface PlayerLite {
  player_id: number;
  full_name: string;
  display_name: string | null;
  team_code: string | null;
  /** For sorting/labeling the career timeline; null if unknown. */
  debut_year: number | null;
}

export interface PlayerCareerStats {
  player_id: number;
  matches: number;
  innings_batted: number;

  // Batting
  runs: number;
  batting_average: number | null;
  strike_rate: number | null;
  highest_score: number | null;
  centuries: number;
  fifties: number;
  fours: number;
  sixes: number;
  not_outs: number;

  // Bowling
  innings_bowled: number;
  wickets: number;
  bowling_average: number | null;
  economy_rate: number | null;
  bowling_strike_rate: number | null;
  five_wicket_hauls: number;
  best_bowling_figures: string | null; // e.g. "5/24", pre-formatted server-side

  // Fielding
  catches: number;
  run_outs: number;
}

export interface PlayerCareerComparisonData {
  player_a: PlayerLite & { stats: PlayerCareerStats };
  player_b: PlayerLite & { stats: PlayerCareerStats };
}

/** A single row of the comparison table -- one stat, both players' values, and how to read it. */
export interface ComparisonMetric {
  key: keyof PlayerCareerStats;
  label: string;
  group: "batting" | "bowling" | "fielding";
  format: (value: number | string | null) => string;
  /** false for stats where lower is better (economy, bowling average) -- controls both the table's highlight and the insights engine's "who leads" call. */
  higherIsBetter: boolean;
  /** Minimum sample (matches) below which a lead isn't worth calling out as a strength -- guards against a 2-match average looking like a skill gap. */
  minSampleForInsight?: number;
}

const dash = (v: number | string | null, fmt: (v: number | string) => string) => (v === null || v === undefined ? "--" : fmt(v));

export const COMPARISON_METRICS: ComparisonMetric[] = [
  { key: "matches", label: "Matches", group: "batting", format: (v) => dash(v, String), higherIsBetter: true },
  { key: "runs", label: "Runs", group: "batting", format: (v) => dash(v, String), higherIsBetter: true },
  {
    key: "batting_average",
    label: "Batting Average",
    group: "batting",
    format: (v) => dash(v, (n) => Number(n).toFixed(2)),
    higherIsBetter: true,
    minSampleForInsight: 5,
  },
  {
    key: "strike_rate",
    label: "Strike Rate",
    group: "batting",
    format: (v) => dash(v, (n) => Number(n).toFixed(1)),
    higherIsBetter: true,
    minSampleForInsight: 5,
  },
  { key: "highest_score", label: "Highest Score", group: "batting", format: (v) => dash(v, String), higherIsBetter: true },
  { key: "centuries", label: "100s", group: "batting", format: (v) => dash(v, String), higherIsBetter: true },
  { key: "fifties", label: "50s", group: "batting", format: (v) => dash(v, String), higherIsBetter: true },
  { key: "fours", label: "4s", group: "batting", format: (v) => dash(v, String), higherIsBetter: true },
  { key: "sixes", label: "6s", group: "batting", format: (v) => dash(v, String), higherIsBetter: true },
  { key: "wickets", label: "Wickets", group: "bowling", format: (v) => dash(v, String), higherIsBetter: true },
  {
    key: "bowling_average",
    label: "Bowling Average",
    group: "bowling",
    format: (v) => dash(v, (n) => Number(n).toFixed(2)),
    higherIsBetter: false,
    minSampleForInsight: 5,
  },
  {
    key: "economy_rate",
    label: "Economy Rate",
    group: "bowling",
    format: (v) => dash(v, (n) => Number(n).toFixed(2)),
    higherIsBetter: false,
    minSampleForInsight: 5,
  },
  {
    key: "bowling_strike_rate",
    label: "Bowling Strike Rate",
    group: "bowling",
    format: (v) => dash(v, (n) => Number(n).toFixed(1)),
    higherIsBetter: false,
    minSampleForInsight: 5,
  },
  { key: "five_wicket_hauls", label: "5-Wicket Hauls", group: "bowling", format: (v) => dash(v, String), higherIsBetter: true },
  { key: "best_bowling_figures", label: "Best Bowling", group: "bowling", format: (v) => dash(v, String), higherIsBetter: true },
  { key: "catches", label: "Catches", group: "fielding", format: (v) => dash(v, String), higherIsBetter: true },
  { key: "run_outs", label: "Run Outs", group: "fielding", format: (v) => dash(v, String), higherIsBetter: true },
];
