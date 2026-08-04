/**
 * Ticket 10.2 -- Venue Comparison data fetching.
 *
 * Deliberately separate from lib/api/charts.ts: those endpoints all
 * take the shared FilterState as query params (a single `venue`
 * among them). This page compares *several* venues at once, which
 * isn't a shape the global filter store represents, so it gets its
 * own small fetch helper keyed on an explicit venue-id list instead.
 *
 * `path` is illustrative, same caveat as lib/api/charts.ts: the
 * venues/analytics routers aren't part of this codebase slice.
 */

import { apiGet } from "./client";

export function venueCompareQueryString(venueIds: number[]): string {
  if (venueIds.length === 0) return "";
  return `?venues=${venueIds.join(",")}`;
}

export function fetchVenueComparison<T>(path: string, venueIds: number[], signal?: AbortSignal): Promise<T> {
  return apiGet<T>(`${path}${venueCompareQueryString(venueIds)}`, signal);
}
