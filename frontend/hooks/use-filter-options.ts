"use client";

/**
 * React Query hooks for the filter options that sit at the *top* of
 * the cascade (Ticket 6.7) or outside it entirely -- nothing upstream
 * scopes these, so they're plain, unparameterized queries.
 *
 *   - season: top of the season -> team -> player -> venue -> match chain.
 *   - city: independent of the cascade (see filters.py docstring).
 *
 * Team/Player/Venue/Match are cascade-aware (their options depend on
 * upstream selections) -- see hooks/use-cascading-filters.ts for
 * those.
 *
 * staleTime/gcTime intentionally mirror the backend's own caching
 * (see backend/app/routers/filters.py -- 6h server TTL, 30m
 * Cache-Control) so the client doesn't re-fetch data the server
 * would just serve from its own cache anyway.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  fetchCityOptions,
  fetchSeasonOptions,
  fetchWeatherRanges,
  type CityOption,
  type SeasonOption,
  type WeatherRanges,
} from "@/lib/api/filters";

export const FILTER_OPTIONS_STALE_TIME_MS = 30 * 60 * 1000; // 30 min -- matches backend Cache-Control
export const FILTER_OPTIONS_GC_TIME_MS = 6 * 60 * 60 * 1000; // 6 hr -- matches backend TTL cache

export function useSeasonOptions(): UseQueryResult<SeasonOption[]> {
  return useQuery({
    queryKey: ["filter-options", "seasons"],
    queryFn: ({ signal }) => fetchSeasonOptions(signal),
    staleTime: FILTER_OPTIONS_STALE_TIME_MS,
    gcTime: FILTER_OPTIONS_GC_TIME_MS,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}

export function useCityOptions(): UseQueryResult<CityOption[]> {
  return useQuery({
    queryKey: ["filter-options", "cities"],
    queryFn: ({ signal }) => fetchCityOptions(signal),
    staleTime: FILTER_OPTIONS_STALE_TIME_MS,
    gcTime: FILTER_OPTIONS_GC_TIME_MS,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}

/** Ticket 6.8 -- min/max bounds for the Temperature/Humidity/Wind Speed range sliders. Unscoped, like cities. */
export function useWeatherRanges(): UseQueryResult<WeatherRanges> {
  return useQuery({
    queryKey: ["filter-options", "weather-ranges"],
    queryFn: ({ signal }) => fetchWeatherRanges(signal),
    staleTime: FILTER_OPTIONS_STALE_TIME_MS,
    gcTime: FILTER_OPTIONS_GC_TIME_MS,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}
