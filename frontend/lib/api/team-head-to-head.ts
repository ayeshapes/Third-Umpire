/**
 * Team Comparison Studio -- Head-to-Head data fetching.
 *
 * Repoint fix (was `/api/teams/compare/head-to-head` and
 * `/api/teams/compare/head-to-head/meetings`, neither of which exist):
 * the real backend route is `/api/teams/head-to-head`
 * (backend/app/routers/teams.py), which already returns everything
 * both sections need in one call -- see
 * hooks/use-team-head-to-head.ts, which fetches it once and lets
 * `toHeadToHeadSummary` / `toHeadToHeadMeetings` below map it into
 * the two components' shapes.
 *
 * Three things the generic `useTeamComparison` + `fetchTeamComparison`
 * path (lib/api/teams.ts) can't do here, which is why this file exists:
 *   1. Query params are `team1_id`/`team2_id`, not the generic
 *      comparison hook's `team_a`/`team_b`.
 *   2. The backend doesn't return team names/codes on the head-to-head
 *      payload itself (only inside each `recent_meetings` row, and only
 *      in whichever order that match's teams happened to be recorded
 *      in) -- team names come from `/api/filters/teams` instead and get
 *      matched onto the response below.
 *   3. `current_streak` isn't returned directly, but it IS derivable
 *      from `recent_meetings` (already ordered most-recent-first) --
 *      computed here instead of left blank. `avg_margin` per team,
 *      by contrast, isn't derivable from the 8 most recent meetings the
 *      backend returns (that field would need an all-time average the
 *      backend doesn't compute), so that stays `null` ("--" in the UI)
 *      rather than being approximated from a small recent sample.
 */

import { apiGet } from "./client";
import { fetchTeamOptions, type TeamOption } from "./filters";
import type { HeadToHeadSummaryData } from "@/components/teams/head-to-head-summary";
import type { HeadToHeadMeetingsData, HeadToHeadMeeting } from "@/components/teams/head-to-head-meetings";

interface RawRecord {
  total_matches: number;
  team1_wins: number;
  team2_wins: number;
  ties: number;
  no_results: number;
}

interface RawRecentMeeting {
  match_id: number;
  season_year: number;
  match_date: string;
  stage: string | null;
  team1_name: string;
  team2_name: string;
  winner_name: string | null;
  win_margin_runs: number | null;
  win_margin_wickets: number | null;
  is_tie: boolean;
  venue_name: string | null;
  team1_runs: number | null;
  team1_wickets: number | null;
  team2_runs: number | null;
  team2_wickets: number | null;
}

export interface RawTeamHeadToHead {
  record: RawRecord;
  venue_wins: unknown[];
  batting: unknown;
  bowling: unknown;
  recent_meetings: RawRecentMeeting[];
}

export function fetchTeamHeadToHead(
  team1Id: number,
  team2Id: number,
  signal?: AbortSignal
): Promise<RawTeamHeadToHead> {
  const params = new URLSearchParams({ team1_id: String(team1Id), team2_id: String(team2Id) });
  return apiGet<RawTeamHeadToHead>(`/api/teams/head-to-head?${params.toString()}`, signal);
}

export function fetchAllTeamOptions(signal?: AbortSignal): Promise<TeamOption[]> {
  return fetchTeamOptions({}, signal);
}

export function toHeadToHeadSummary(
  raw: RawTeamHeadToHead,
  teamA: TeamOption,
  teamB: TeamOption
): HeadToHeadSummaryData {
  const { record, recent_meetings } = raw;
  const totalMatches = record.total_matches;

  // Derived from the most-recent-first recent_meetings list: how many
  // meetings in a row (starting from the most recent) the same team won.
  let currentStreak: HeadToHeadSummaryData["current_streak"] = null;
  if (recent_meetings.length > 0) {
    const first = recent_meetings[0];
    if (first.winner_name) {
      let count = 0;
      for (const m of recent_meetings) {
        if (m.winner_name === first.winner_name) count += 1;
        else break;
      }
      const streakTeamCode = first.winner_name === teamA.team_name ? teamA.team_code : teamB.team_code;
      currentStreak = { team_code: streakTeamCode, count };
    }
  }

  return {
    team_a: { team_id: teamA.team_id, team_name: teamA.team_name, team_code: teamA.team_code },
    team_b: { team_id: teamB.team_id, team_name: teamB.team_name, team_code: teamB.team_code },
    total_matches: totalMatches,
    team_a_wins: record.team1_wins,
    team_b_wins: record.team2_wins,
    no_results: record.no_results,
    team_a_win_pct: totalMatches ? (record.team1_wins / totalMatches) * 100 : 0,
    team_b_win_pct: totalMatches ? (record.team2_wins / totalMatches) * 100 : 0,
    // Not derivable from the 8 most recent meetings the backend returns --
    // an all-time average needs a backend aggregate that doesn't exist yet.
    team_a_avg_margin_runs: null,
    team_b_avg_margin_runs: null,
    current_streak: currentStreak,
  };
}

export function toHeadToHeadMeetings(
  raw: RawTeamHeadToHead,
  teamA: TeamOption,
  teamB: TeamOption
): HeadToHeadMeetingsData {
  const meetings: HeadToHeadMeeting[] = raw.recent_meetings.map((m) => {
    // Each match's own team1/team2 order doesn't necessarily match which
    // one is "Team A" vs "Team B" in this comparison -- match by name.
    const aIsTeam1 = m.team1_name === teamA.team_name;
    const teamAScore = aIsTeam1 ? m.team1_runs : m.team2_runs;
    const teamAWickets = aIsTeam1 ? m.team1_wickets : m.team2_wickets;
    const teamBScore = aIsTeam1 ? m.team2_runs : m.team1_runs;
    const teamBWickets = aIsTeam1 ? m.team2_wickets : m.team1_wickets;

    const winnerCode = m.winner_name === teamA.team_name ? teamA.team_code : m.winner_name === teamB.team_name ? teamB.team_code : null;

    const margin =
      m.win_margin_runs != null
        ? `${m.win_margin_runs} run${m.win_margin_runs === 1 ? "" : "s"}`
        : m.win_margin_wickets != null
          ? `${m.win_margin_wickets} wicket${m.win_margin_wickets === 1 ? "" : "s"}`
          : null;

    return {
      match_id: m.match_id,
      match_date: m.match_date,
      season_year: m.season_year,
      venue_name: m.venue_name ?? "Unknown venue",
      team_a_score: teamAScore != null ? `${teamAScore}/${teamAWickets ?? 10}` : "--",
      team_b_score: teamBScore != null ? `${teamBScore}/${teamBWickets ?? 10}` : "--",
      winner_team_code: m.is_tie ? null : winnerCode,
      margin: m.is_tie ? null : margin,
    };
  });

  return {
    team_a_code: teamA.team_code,
    team_b_code: teamB.team_code,
    meetings,
  };
}
