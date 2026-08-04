"use client";

/**
 * Team Comparison Studio: Head-to-Head -- repointed to the real
 * `/api/teams/head-to-head` endpoint. Separate from useTeamComparison
 * (hooks/use-team-comparison.ts) because that hook sends the generic
 * comparison query params/shape (see lib/api/teams.ts), and this
 * endpoint uses `team1_id`/`team2_id` with its own response shape that
 * doesn't include team names -- so this also pulls the team list
 * (`/api/filters/teams`, already used by <TeamSelect>) to label it.
 * Both head-to-head components share this one query (same queryKey)
 * so switching Team A/B triggers exactly one request, not two.
 */

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { fetchTeamHeadToHead, fetchAllTeamOptions, type RawTeamHeadToHead } from "@/lib/api/team-head-to-head";
import type { TeamOption } from "@/lib/api/filters";

export interface TeamHeadToHeadRaw {
  raw: RawTeamHeadToHead;
  teamA: TeamOption;
  teamB: TeamOption;
}

export function useTeamHeadToHead(
  teamAId: number | null,
  teamBId: number | null
): UseQueryResult<TeamHeadToHeadRaw | null> {
  return useQuery({
    queryKey: ["team-head-to-head", teamAId, teamBId],
    queryFn: async ({ signal }) => {
      const [raw, teams] = await Promise.all([
        fetchTeamHeadToHead(teamAId as number, teamBId as number, signal),
        fetchAllTeamOptions(signal),
      ]);
      const teamA = teams.find((t) => t.team_id === teamAId);
      const teamB = teams.find((t) => t.team_id === teamBId);
      if (!teamA || !teamB) return null;
      return { raw, teamA, teamB };
    },
    enabled: teamAId !== null && teamBId !== null && teamAId !== teamBId,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}
