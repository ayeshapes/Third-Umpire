"use client";

/**
 * Career Statistics + Season Comparison -- repointed to the real
 * `/api/players/compare` endpoint. Separate from usePlayerComparison
 * (hooks/use-player-comparison.ts) because that hook sends the generic
 * comparison query params/shape (see lib/api/players.ts), and this
 * endpoint uses `player1_id`/`player2_id` with its own response shape.
 * Both components share this one query (same queryKey) so switching
 * Player A/B triggers exactly one network request, not two.
 */

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { fetchPlayersCompare, type RawPlayersCompare } from "@/lib/api/player-compare";

export function usePlayerCareerCompare(
  playerAId: number | null,
  playerBId: number | null
): UseQueryResult<RawPlayersCompare> {
  return useQuery({
    queryKey: ["players-compare", playerAId, playerBId],
    queryFn: ({ signal }) => fetchPlayersCompare(playerAId as number, playerBId as number, signal),
    enabled: playerAId !== null && playerBId !== null && playerAId !== playerBId,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}
