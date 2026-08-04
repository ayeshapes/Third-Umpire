"use client";

/**
 * Ticket 12.1 -- Player Comparison Studio data hook.
 *
 * Same shape as hooks/use-venue-comparison.ts (query key includes
 * every input that should trigger a refetch, keepPreviousData so
 * swapping Player B doesn't flash every section back to a loading
 * skeleton) but keyed on the two explicit player IDs this page
 * manages locally, layered on top of the *shared* filter store
 * (hooks/use-chart-data.ts's pattern) for the season/venue/opponent
 * scoping both players are compared through -- see
 * lib/api/players.ts for why player selection itself stays local.
 */

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { useFilters } from "@/store/filters";
import { fetchPlayerComparison } from "@/lib/api/players";

export function usePlayerComparison<T>(path: string, playerAId: number | null, playerBId: number | null): UseQueryResult<T> {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ["player-compare", path, playerAId, playerBId, filters],
    queryFn: ({ signal }) => fetchPlayerComparison<T>(path, playerAId, playerBId, filters, signal),
    enabled: playerAId !== null && playerBId !== null && playerAId !== playerBId,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}
