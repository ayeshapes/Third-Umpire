/**
 * Ticket 12.1 -- Player Comparison Studio data fetching.
 *
 * Deliberately separate from lib/api/charts.ts, same reasoning as
 * lib/api/venues.ts: those endpoints take the shared FilterState
 * keyed on a *single* `player`, but this page needs exactly two
 * players selected at once -- not a shape the global filter store
 * represents (store/filters/types.ts). So player_a/player_b are
 * explicit params here, layered on top of whatever's in the shared
 * filter bar (season/venue/opponent/etc still apply to *both*
 * players -- that's the "Shared filters" requirement: narrow the
 * window both careers are compared through, without needing a
 * second `player` slot in the global store).
 *
 * `path` is illustrative, same caveat as lib/api/charts.ts and
 * lib/api/venues.ts: the players/analytics routers aren't part of
 * this codebase slice.
 */

import { apiGet } from "./client";
import type { FilterState } from "@/store/filters";

/** Every shared filter field *except* `player` -- comparison state below owns player selection instead. */
function sharedScopeParams(filters: FilterState): Record<string, string> {
  const { player: _player, ...scope } = filters;
  const params: Record<string, string> = {};
  (Object.keys(scope) as (keyof typeof scope)[]).forEach((key) => {
    const value = scope[key];
    if (value !== null && value !== undefined) params[key] = String(value);
  });
  return params;
}

export function playerComparisonQueryString(playerAId: number | null, playerBId: number | null, filters: FilterState): string {
  const search = new URLSearchParams(sharedScopeParams(filters));
  if (playerAId !== null) search.set("player_a", String(playerAId));
  if (playerBId !== null) search.set("player_b", String(playerBId));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function fetchPlayerComparison<T>(
  path: string,
  playerAId: number | null,
  playerBId: number | null,
  filters: FilterState,
  signal?: AbortSignal
): Promise<T> {
  return apiGet<T>(`${path}${playerComparisonQueryString(playerAId, playerBId, filters)}`, signal);
}
