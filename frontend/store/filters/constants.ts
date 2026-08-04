import type { FilterKey, FilterState } from "./types";

/**
 * Default ("nothing selected") value for every filter. Adding a new
 * filter to the store is 3 steps, all colocated in this folder:
 *   1. Add the field to `FilterState` in ./types.ts
 *   2. Add its default value here
 *   3. (optional) Add a display label to FILTER_LABELS below
 * No changes needed to the context, reducer, or hooks -- they're all
 * generic over `FilterKey`.
 */
export const DEFAULT_FILTERS: FilterState = {
  season: null,
  team: null,
  player: null,
  venue: null,
  match: null,
  city: null,
  opponent: null,
  toss: null,
  result: null,
  innings: null,
  phase: null,

  // Ticket 6.8 -- Advanced Filter Categories
  tossWinner: null,
  battingOrder: null,
  dayNight: null,
  weather: null,
  temperatureMin: null,
  temperatureMax: null,
  humidityMin: null,
  humidityMax: null,
  windSpeedMin: null,
  windSpeedMax: null,
};

/** Human-readable label per filter key, for chips/badges/headers. */
export const FILTER_LABELS: Record<FilterKey, string> = {
  season: "Season",
  team: "Team",
  player: "Player",
  venue: "Venue",
  match: "Match",
  city: "City",
  opponent: "Opponent",
  toss: "Toss Decision",
  result: "Match Result",
  innings: "Innings",
  phase: "Match Phase",

  // Ticket 6.8 -- Advanced Filter Categories
  tossWinner: "Toss Winner",
  battingOrder: "Batting Order",
  dayNight: "Day/Night",
  weather: "Weather",
  temperatureMin: "Min Temperature (°C)",
  temperatureMax: "Max Temperature (°C)",
  humidityMin: "Min Humidity (%)",
  humidityMax: "Max Humidity (%)",
  windSpeedMin: "Min Wind Speed (km/h)",
  windSpeedMax: "Max Wind Speed (km/h)",
};

/**
 * Filter keys that make up a "range" pair (min/max) sharing one control
 * in the UI. Keyed by the field group name -- used by
 * <RangeFilterControl> to know which two FilterState keys to write.
 */
export const RANGE_FILTER_GROUPS = {
  temperature: { min: "temperatureMin", max: "temperatureMax", unit: "°C" },
  humidity: { min: "humidityMin", max: "humidityMax", unit: "%" },
  windSpeed: { min: "windSpeedMin", max: "windSpeedMax", unit: "km/h" },
} as const satisfies Record<string, { min: FilterKey; max: FilterKey; unit: string }>;

export type RangeFilterGroupKey = keyof typeof RANGE_FILTER_GROUPS;

export const FILTER_KEYS = Object.keys(DEFAULT_FILTERS) as FilterKey[];
