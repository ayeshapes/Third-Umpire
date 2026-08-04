"use client";

/**
 * Match Insights page -- shared raw `/api/matches/{id}/detail` fetch.
 *
 * Every section on the page (Summary, Timeline, Worm, Manhattan x2,
 * Run Rate, Partnership Timeline, Highlights) reads from this same
 * payload -- see lib/api/match-charts.ts for the per-section mapping.
 * One queryKey means React Query dedupes all of them into a single
 * network request instead of seven.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchMatchDetail, type RawMatchDetail } from "@/lib/api/match-detail";

export function useMatchDetail(matchId: number | string | null): UseQueryResult<RawMatchDetail | null> {
  return useQuery({
    queryKey: ["match-detail", matchId],
    queryFn: async ({ signal }) => {
      if (matchId === null) return null;
      return fetchMatchDetail(matchId, signal);
    },
    enabled: matchId !== null,
    staleTime: 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}
