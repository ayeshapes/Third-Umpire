"use client";

/**
 * Match Summary -- reads from the shared `/api/matches/{id}/detail`
 * fetch (hooks/use-match-detail.ts) so this section shares one
 * network request with Timeline/Worm/Manhattan/Run Rate/Partnership
 * Timeline/Highlights instead of firing its own.
 */

import { useMemo } from "react";
import { type UseQueryResult } from "@tanstack/react-query";
import { useFilters } from "@/store/filters";
import { useMatchDetail } from "@/hooks/use-match-detail";
import { toMatchSummary } from "@/lib/api/match-detail";
import type { MatchSummaryData } from "@/components/match/match-summary";

export function useMatchSummary(): UseQueryResult<MatchSummaryData | null> {
  const { filters } = useFilters();
  const matchId = filters.match;
  const query = useMatchDetail(matchId);

  const data = useMemo(() => (query.data ? toMatchSummary(query.data) : null), [query.data]);

  return { ...query, data } as UseQueryResult<MatchSummaryData | null>;
}
