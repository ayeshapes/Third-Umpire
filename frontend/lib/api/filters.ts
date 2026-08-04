/**
 * Typed clients for the read-only filter-option endpoints
 * (backend/app/routers/filters.py). Shapes match `cur.fetchall()` on
 * each router's SELECT -- update these if a column is added/renamed
 * there.
 *
 * Ticket 6.7: teams/players/venues/matches accept the filters "above"
 * them in the cascade as optional params, which get serialized as
 * query params here. Passing `undefined`/`null` omits that param
 * entirely (matches the backend's "no param = unscoped" behavior).
 */

import { apiGet } from "./client";

export interface SeasonOption {
  season_id: number;
  season_year: number;
}

export interface TeamOption {
  team_id: number;
  team_name: string;
  team_code: string;
}

export interface PlayerOption {
  player_id: number;
  full_name: string;
  display_name: string | null;
}

export interface VenueOption {
  venue_id: number;
  venue_name: string;
  city: string | null;
}

export interface MatchOption {
  match_id: number;
  match_date: string;
  team1_name: string;
  team2_name: string;
  venue_name: string;
}

export type CityOption = string;

/** Ticket 6.8 -- observed min/max bounds for a range-slider filter. */
export interface WeatherRangeBound {
  min: number | null;
  max: number | null;
}

export interface WeatherRanges {
  temperature: WeatherRangeBound;
  humidity: WeatherRangeBound;
  wind_speed: WeatherRangeBound;
}

/** Drops null/undefined/empty entries, then serializes the rest as query params. */
function toQueryString(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function fetchSeasonOptions(signal?: AbortSignal) {
  return apiGet<SeasonOption[]>("/api/filters/seasons", signal);
}

export interface TeamFilterParams {
  season?: string | null;
}

export function fetchTeamOptions(params: TeamFilterParams = {}, signal?: AbortSignal) {
  return apiGet<TeamOption[]>(`/api/filters/teams${toQueryString(params)}`, signal);
}

export interface PlayerFilterParams {
  season?: string | null;
  team?: string | null;
}

export function fetchPlayerOptions(params: PlayerFilterParams = {}, signal?: AbortSignal) {
  return apiGet<PlayerOption[]>(`/api/filters/players${toQueryString(params)}`, signal);
}

export interface VenueFilterParams {
  season?: string | null;
  team?: string | null;
  player?: string | null;
}

export function fetchVenueOptions(params: VenueFilterParams = {}, signal?: AbortSignal) {
  return apiGet<VenueOption[]>(`/api/filters/venues${toQueryString(params)}`, signal);
}

export interface MatchFilterParams {
  season?: string | null;
  team?: string | null;
  player?: string | null;
  venue?: string | null;
}

export function fetchMatchOptions(params: MatchFilterParams = {}, signal?: AbortSignal) {
  return apiGet<MatchOption[]>(`/api/filters/matches${toQueryString(params)}`, signal);
}

export function fetchCityOptions(signal?: AbortSignal) {
  return apiGet<CityOption[]>("/api/filters/cities", signal);
}

/** Ticket 6.8 -- min/max bounds for the Temperature/Humidity/Wind Speed sliders. */
export function fetchWeatherRanges(signal?: AbortSignal) {
  return apiGet<WeatherRanges>("/api/filters/weather-ranges", signal);
}
