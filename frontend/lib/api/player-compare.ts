/**
 * Player Comparison Studio -- Career Statistics + Season Comparison
 * data fetching.
 *
 * Repoint fix (was `/api/players/compare/career-stats` and
 * `/api/players/compare/seasons`, neither of which exist): the real
 * backend route is `/api/players/compare` (backend/app/routers/players.py),
 * which returns ONE bundle per player -- { player, batting, bowling,
 * catches, timeline } -- that already covers both sections, so both
 * components fetch it through the same query (see
 * hooks/use-player-career-compare.ts) instead of hitting the network twice.
 *
 * Three things the generic `usePlayerComparison` + `fetchPlayerComparison`
 * path (lib/api/players.ts) can't do here, which is why this file exists:
 *   1. Query params are `player1_id`/`player2_id`, not the generic
 *      comparison hook's `player_a`/`player_b`.
 *   2. The response shape (`{ player1: {...}, player2: {...} }`, each
 *      with nested `batting`/`bowling`/`catches`/`timeline`) doesn't match
 *      either `PlayerCareerComparisonData` (components/players/types.ts)
 *      or `SeasonComparisonData` (components/players/season-comparison.tsx)
 *      -- `toCareerStats` / `toSeasonComparison` below do that mapping.
 *   3. The backend doesn't compute every stat the Career Statistics table
 *      has a column for (centuries, fifties, highest_score, not_outs,
 *      five_wicket_hauls, best_bowling_figures, run_outs, matches aren't
 *      returned) -- those come back `null` ("--" in the table) instead of
 *      being invented.
 */

import { apiGet } from "./client";
import type { PlayerCareerComparisonData, PlayerCareerStats, PlayerLite } from "@/components/players/types";
import type { SeasonComparisonData, SeasonComparisonPoint } from "@/components/players/season-comparison";

interface RawPlayerCore {
  player_id: number;
  full_name: string;
  display_name: string | null;
  nationality: string | null;
  primary_role: string | null;
  batting_hand: string | null;
  bowling_arm: string | null;
  bowler_type: string | null;
}

interface RawBattingProfile {
  innings: number;
  runs: number;
  average: number | null;
  strike_rate: number | null;
  boundary_pct: number | null;
  six_pct: number | null;
  balls_per_boundary: number | null;
  dot_ball_pct: number | null;
  fours: number;
  sixes: number;
}

interface RawBowlingProfile {
  innings: number;
  wickets: number;
  economy: number | null;
  average: number | null;
  strike_rate: number | null;
  maidens: number;
}

interface RawTimelinePoint {
  season_year: number;
  runs: number;
  wickets: number;
}

interface RawPlayerCompareBundle {
  player: RawPlayerCore;
  batting: RawBattingProfile;
  bowling: RawBowlingProfile;
  catches: number;
  timeline: RawTimelinePoint[];
}

export interface RawPlayersCompare {
  player1?: RawPlayerCompareBundle;
  player2?: RawPlayerCompareBundle;
  error?: string;
}

export function fetchPlayersCompare(
  player1Id: number,
  player2Id: number,
  signal?: AbortSignal
): Promise<RawPlayersCompare> {
  const params = new URLSearchParams({ player1_id: String(player1Id), player2_id: String(player2Id) });
  return apiGet<RawPlayersCompare>(`/api/players/compare?${params.toString()}`, signal);
}

function toPlayerLite(p: RawPlayerCore): PlayerLite {
  return {
    player_id: p.player_id,
    full_name: p.full_name,
    display_name: p.display_name,
    // Not returned by /api/players/compare -- no team/debut data on this bundle.
    team_code: null,
    debut_year: null,
  };
}

function toCareerStatsRow(b: RawPlayerCompareBundle): PlayerCareerStats {
  return {
    player_id: b.player.player_id,
    // Not returned by the backend bundle -- left null/0 rather than guessed.
    matches: 0,
    innings_batted: b.batting.innings,

    runs: b.batting.runs,
    batting_average: b.batting.average,
    strike_rate: b.batting.strike_rate,
    highest_score: null,
    centuries: 0,
    fifties: 0,
    fours: b.batting.fours,
    sixes: b.batting.sixes,
    not_outs: 0,

    innings_bowled: b.bowling.innings,
    wickets: b.bowling.wickets,
    bowling_average: b.bowling.average,
    economy_rate: b.bowling.economy,
    bowling_strike_rate: b.bowling.strike_rate,
    five_wicket_hauls: 0,
    best_bowling_figures: null,

    catches: b.catches,
    run_outs: 0,
  };
}

export function toCareerStats(raw: RawPlayersCompare): PlayerCareerComparisonData | null {
  if (!raw.player1 || !raw.player2) return null;
  return {
    player_a: { ...toPlayerLite(raw.player1.player), stats: toCareerStatsRow(raw.player1) },
    player_b: { ...toPlayerLite(raw.player2.player), stats: toCareerStatsRow(raw.player2) },
  };
}

export function toSeasonComparison(raw: RawPlayersCompare): SeasonComparisonData | null {
  if (!raw.player1 || !raw.player2) return null;
  const a = raw.player1;
  const b = raw.player2;

  const years = Array.from(
    new Set([...a.timeline.map((t) => t.season_year), ...b.timeline.map((t) => t.season_year)])
  ).sort((x, y) => x - y);

  const aByYear = new Map(a.timeline.map((t) => [t.season_year, t]));
  const bByYear = new Map(b.timeline.map((t) => [t.season_year, t]));

  const points: SeasonComparisonPoint[] = years.map((year) => ({
    season_year: year,
    player_a_runs: aByYear.get(year)?.runs ?? 0,
    player_b_runs: bByYear.get(year)?.runs ?? 0,
    player_a_wickets: aByYear.get(year)?.wickets ?? 0,
    player_b_wickets: bByYear.get(year)?.wickets ?? 0,
  }));

  return {
    player_a_name: a.player.display_name ?? a.player.full_name,
    player_b_name: b.player.display_name ?? b.player.full_name,
    points,
  };
}
