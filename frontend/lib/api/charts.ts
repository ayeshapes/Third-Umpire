/**
 * Global Chart Synchronization -- generic fetch layer.
 *
 * Every chart endpoint takes the *same* shared FilterState as query
 * params (whatever's currently set gets sent, whatever's null gets
 * omitted) -- this is what lets one hook (hooks/use-chart-data.ts)
 * serve every chart on Dashboard/Players/Teams/Records/Analytics
 * instead of each page hand-rolling its own param-building.
 */

import { apiGet } from "./client";
import type { FilterState } from "@/store/filters";

function filtersToChartParams(filters: FilterState): Record<string, string> {
  const params: Record<string, string> = {};
  (Object.keys(filters) as (keyof FilterState)[]).forEach((key) => {
    const value = filters[key];
    if (value !== null && value !== undefined) params[key] = String(value);
  });
  return params;
}

export function chartQueryString(filters: FilterState): string {
  const search = new URLSearchParams(filtersToChartParams(filters));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * `path` is a chart endpoint, e.g. `/api/analytics/runs-by-season`.
 * NOTE: the analytics/players/teams/leaderboards routers referenced in
 * backend/app/main.py weren't part of this codebase slice, so exact
 * chart endpoint paths/response shapes are illustrative -- point
 * `path` at whatever your real chart routes are.
 */
export function fetchChartData<T>(path: string, filters: FilterState, signal?: AbortSignal): Promise<T> {
  return apiGet<T>(`${path}${chartQueryString(filters)}`, signal);
}
