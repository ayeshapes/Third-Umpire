/**
 * Match Summary -- data fetching.
 *
 * Repoint fix (was `/api/matches/summary`, which doesn't exist): the
 * real backend route is `/api/matches/{match_id}/detail`
 * (backend/app/routers/matches.py), which already returns full
 * scorecards/worm/partnerships data -- Match Summary only needs the
 * headline slice of it.
 *
 * Two things the generic `useChartData` + `fetchChartData` path
 * (lib/api/charts.ts) can't do here, which is why this file exists
 * instead of just changing the `path` string:
 *   1. `match_id` is a path segment (`/api/matches/{match_id}/detail`),
 *      not a query param -- `fetchChartData` only ever appends filters
 *      as `?query=params`.
 *   2. The response shape is `{ match, innings }`, not the flat
 *      `MatchSummaryData` the component renders -- `toMatchSummary`
 *      below does that mapping once, here, instead of in the component.
 *
 * The raw types below are exported for lib/api/match-charts.ts, which
 * maps this same payload into Worm/Manhattan/Run Rate/Partnership
 * Timeline/Match Timeline/Match Highlights -- every other match-page
 * section turned out to need this same endpoint, not a new one each.
 */

import { apiGet } from "./client";
import type { MatchSummaryData, MatchSummaryTeam } from "@/components/match/match-summary";

export interface RawMatchRow {
  match_id: number;
  season_year: number;
  match_date: string;
  match_number: number | null;
  stage: string | null;
  is_day_night: boolean;
  status: string | null;
  is_dls_affected: boolean;
  team1_id: number;
  team1_name: string;
  team2_id: number;
  team2_name: string;
  venue_name: string | null;
  city: string | null;
  toss_decision: "bat" | "bowl";
  toss_winner_name: string;
  winner_team_id: number | null;
  winner_name: string | null;
  win_margin_runs: number | null;
  win_margin_wickets: number | null;
  is_tie: boolean;
  decided_by_super_over: boolean;
  player_of_match_name: string | null;
}

export interface RawWormPoint {
  over_number: number;
  runs_conceded: number;
  wickets: number;
  cumulative_runs: number;
  cumulative_wickets: number;
}

export interface RawFallOfWicket {
  running_score: number;
  over_number: number;
  ball_number: number;
  dismissal_type: string | null;
  dismissed_player_name: string | null;
}

export interface RawPartnership {
  wicket_number: number;
  batter1_name: string | null;
  batter1_runs: number;
  batter2_name: string | null;
  batter2_runs: number;
  runs: number;
  balls_faced: number;
  is_unbeaten: boolean;
  start_over: number | null;
  end_over: number | null;
}

export interface RawBoundary {
  over_number: number;
  ball_number: number;
  runs_batter: 4 | 6;
  striker_name: string | null;
}

export interface RawBattingRow {
  batting_position: number | null;
  player_id: number;
  display_name: string | null;
  full_name: string;
  runs: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  strike_rate: number | null;
  dismissal_type: string | null;
}

export interface RawBowlingRow {
  player_id: number;
  display_name: string | null;
  full_name: string;
  overs_bowled: number;
  maidens: number;
  runs_conceded: number;
  wickets: number;
  economy: number | null;
  first_over: number;
}

export interface RawInnings {
  innings_number: number;
  batting_team_id: number;
  bowling_team_id: number;
  total_runs: number;
  total_wickets: number;
  total_overs: number;
  worm: RawWormPoint[];
  batting: RawBattingRow[];
  bowling: RawBowlingRow[];
  fall_of_wickets: RawFallOfWicket[];
  partnerships: RawPartnership[];
  boundaries: RawBoundary[];
}

export interface RawMatchDetail {
  match: RawMatchRow | null;
  innings: RawInnings[];
  error?: string;
}

export function fetchMatchDetail(matchId: string | number, signal?: AbortSignal): Promise<RawMatchDetail> {
  return apiGet<RawMatchDetail>(`/api/matches/${matchId}/detail`, signal);
}

function teamLine(innings: RawInnings[], teamId: number): MatchSummaryTeam | null {
  // Normally one innings per team; if a team batted twice (rare edge
  // cases in the source data) take their first innings -- the one a
  // scorecard header actually refers to.
  const inn = innings.find((i) => i.batting_team_id === teamId);
  if (!inn) return null;
  return { name: "", short_name: "", runs: inn.total_runs, wickets: inn.total_wickets, overs: inn.total_overs };
}

function resultText(m: RawMatchRow): string {
  if (m.is_tie) return m.decided_by_super_over ? "Match tied (won in Super Over)" : "Match tied";
  if (!m.winner_name) return m.status ?? "Result unavailable";
  if (m.win_margin_wickets != null) return `${m.winner_name} won by ${m.win_margin_wickets} wicket${m.win_margin_wickets === 1 ? "" : "s"}`;
  if (m.win_margin_runs != null) return `${m.winner_name} won by ${m.win_margin_runs} run${m.win_margin_runs === 1 ? "" : "s"}`;
  return `${m.winner_name} won`;
}

export function toMatchSummary(raw: RawMatchDetail): MatchSummaryData | null {
  const m = raw.match;
  if (!m) return null;

  const team1Line = teamLine(raw.innings, m.team1_id);
  const team2Line = teamLine(raw.innings, m.team2_id);

  return {
    season: String(m.season_year),
    venue: m.venue_name ?? "Unknown venue",
    city: m.city ?? "",
    date: m.match_date,
    team1: { ...(team1Line ?? { runs: 0, wickets: 0, overs: 0 }), name: m.team1_name, short_name: m.team1_name },
    team2: { ...(team2Line ?? { runs: 0, wickets: 0, overs: 0 }), name: m.team2_name, short_name: m.team2_name },
    result_text: resultText(m),
    toss_winner: m.toss_winner_name,
    toss_decision: m.toss_decision,
    player_of_match: m.player_of_match_name,
  };
}
