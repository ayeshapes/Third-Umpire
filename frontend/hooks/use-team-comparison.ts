"use client";

/**
 * Team Comparison Studio data hook.
 *
 * Same shape as hooks/use-player-comparison.ts (query key includes
 * every input that should trigger a refetch, keepPreviousData so
 * swapping Team B doesn't flash every section back to a loading
 * skeleton) but keyed on the two explicit team IDs this page manages
 * locally, layered on top of the *shared* filter store
 * (hooks/use-chart-data.ts's pattern) for the season/venue/toss/
 * weather scoping both teams are compared through -- see
 * lib/api/teams.ts for why team selection itself stays local.
 */

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { useFilters } from "@/store/filters";
import { fetchTeamComparison } from "@/lib/api/teams";

export function useTeamComparison<T>(path: string, teamAId: number | null, teamBId: number | null): UseQueryResult<T> {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ["team-compare", path, teamAId, teamBId, filters],
    queryFn: ({ signal }) => fetchTeamComparison<T>(path, teamAId, teamBId, filters, signal),
    enabled: teamAId !== null && teamBId !== null && teamAId !== teamBId,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}
