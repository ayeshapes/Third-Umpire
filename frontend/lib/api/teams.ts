/**
 * Team Comparison Studio -- data fetching.
 *
 * Deliberately separate from lib/api/charts.ts, same reasoning as
 * lib/api/players.ts: those endpoints take the shared FilterState
 * keyed on a *single* `team` (plus a single `opponent`), but this
 * page needs exactly two teams selected at once for a head-to-head --
 * not a shape the global filter store represents (store/filters/types.ts).
 * So team_a/team_b are explicit params here, layered on top of
 * whatever's in the shared filter bar (season/venue/toss/weather/etc
 * still apply to *both* teams -- narrows the window the comparison is
 * read through, without needing a second `team` slot in the global
 * store). `team` and `opponent` are stripped out of the shared scope
 * for the same reason `player` is stripped in lib/api/players.ts:
 * this page's own Team A/B selection replaces them.
 *
 * `path` is illustrative, same caveat as lib/api/players.ts and
 * lib/api/venues.ts: the teams/analytics routers referenced in
 * backend/app/main.py aren't part of this codebase slice.
 */

import { apiGet } from "./client";
import type { FilterState } from "@/store/filters";

/** Every shared filter field *except* `team`/`opponent` -- comparison state below owns team selection instead. */
function sharedScopeParams(filters: FilterState): Record<string, string> {
  const { team: _team, opponent: _opponent, ...scope } = filters;
  const params: Record<string, string> = {};
  (Object.keys(scope) as (keyof typeof scope)[]).forEach((key) => {
    const value = scope[key];
    if (value !== null && value !== undefined) params[key] = String(value);
  });
  return params;
}

export function teamComparisonQueryString(teamAId: number | null, teamBId: number | null, filters: FilterState): string {
  const search = new URLSearchParams(sharedScopeParams(filters));
  if (teamAId !== null) search.set("team_a", String(teamAId));
  if (teamBId !== null) search.set("team_b", String(teamBId));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function fetchTeamComparison<T>(
  path: string,
  teamAId: number | null,
  teamBId: number | null,
  filters: FilterState,
  signal?: AbortSignal
): Promise<T> {
  return apiGet<T>(`${path}${teamComparisonQueryString(teamAId, teamBId, filters)}`, signal);
}
