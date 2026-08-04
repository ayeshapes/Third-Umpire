/**
 * Pure FilterState <-> URL query-string helpers (Ticket 6.5).
 * No Next.js imports here on purpose -- kept framework-agnostic and
 * easy to unit test. `use-url-sync.tsx` is the client-only glue that
 * calls these against next/navigation's router/searchParams.
 *
 * Encoding rules:
 *   - Only non-default (non-null) values are written to the URL, so
 *     "no filters" is just the bare pathname, not `?season=&team=`.
 *   - `innings`/`toss`/`result`/`phase` are validated against their
 *     known enum values on the way *in* from the URL -- a hand-edited
 *     or stale URL can't inject an invalid FilterState.
 */

import { DEFAULT_FILTERS } from "./constants";
import type {
  BattingOrder,
  DayNight,
  FilterKey,
  FilterState,
  InningsNumber,
  MatchPhase,
  ResultOutcome,
  TossDecision,
  WeatherCondition,
} from "./types";

const TOSS_VALUES: readonly TossDecision[] = ["bat", "bowl"];
const RESULT_VALUES: readonly ResultOutcome[] = ["won", "lost", "tied", "no_result"];
const PHASE_VALUES: readonly MatchPhase[] = ["powerplay", "middle", "death"];
const INNINGS_VALUES: readonly InningsNumber[] = [1, 2];

// Ticket 6.8 -- Advanced Filter Categories
const WEATHER_VALUES: readonly WeatherCondition[] = ["clear", "cloudy", "overcast", "rain", "humid", "windy"];
const DAY_NIGHT_VALUES: readonly DayNight[] = ["day", "day_night", "night"];
const BATTING_ORDER_VALUES: readonly BattingOrder[] = ["batting_first", "chasing"];

/** Minimal shape both `URLSearchParams` and Next's `ReadonlyURLSearchParams` satisfy. */
export interface ReadableSearchParams {
  get(key: string): string | null;
}

export function filtersToSearchParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  (Object.keys(DEFAULT_FILTERS) as FilterKey[]).forEach((key) => {
    const value = filters[key];
    if (value === null || value === undefined || value === DEFAULT_FILTERS[key]) return;
    params.set(key, String(value));
  });
  return params;
}

export function searchParamsToFilters(searchParams: ReadableSearchParams): Partial<FilterState> {
  const patch: Partial<FilterState> = {};

  const season = searchParams.get("season");
  if (season) patch.season = season;

  const team = searchParams.get("team");
  if (team) patch.team = team;

  const player = searchParams.get("player");
  if (player) patch.player = player;

  const venue = searchParams.get("venue");
  if (venue) patch.venue = venue;

  const match = searchParams.get("match");
  if (match) patch.match = match;

  const city = searchParams.get("city");
  if (city) patch.city = city;

  const opponent = searchParams.get("opponent");
  if (opponent) patch.opponent = opponent;

  const toss = searchParams.get("toss");
  if (toss && (TOSS_VALUES as readonly string[]).includes(toss)) {
    patch.toss = toss as TossDecision;
  }

  const result = searchParams.get("result");
  if (result && (RESULT_VALUES as readonly string[]).includes(result)) {
    patch.result = result as ResultOutcome;
  }

  const innings = searchParams.get("innings");
  if (innings && INNINGS_VALUES.includes(Number(innings) as InningsNumber)) {
    patch.innings = Number(innings) as InningsNumber;
  }

  const phase = searchParams.get("phase");
  if (phase && (PHASE_VALUES as readonly string[]).includes(phase)) {
    patch.phase = phase as MatchPhase;
  }

  // Ticket 6.8 -- Advanced Filter Categories
  const tossWinner = searchParams.get("tossWinner");
  if (tossWinner) patch.tossWinner = tossWinner;

  const battingOrder = searchParams.get("battingOrder");
  if (battingOrder && (BATTING_ORDER_VALUES as readonly string[]).includes(battingOrder)) {
    patch.battingOrder = battingOrder as BattingOrder;
  }

  const dayNight = searchParams.get("dayNight");
  if (dayNight && (DAY_NIGHT_VALUES as readonly string[]).includes(dayNight)) {
    patch.dayNight = dayNight as DayNight;
  }

  const weather = searchParams.get("weather");
  if (weather && (WEATHER_VALUES as readonly string[]).includes(weather)) {
    patch.weather = weather as WeatherCondition;
  }

  (["temperatureMin", "temperatureMax", "humidityMin", "humidityMax", "windSpeedMin", "windSpeedMax"] as const).forEach(
    (key) => {
      const raw = searchParams.get(key);
      if (raw === null || raw === "") return;
      const num = Number(raw);
      if (!Number.isNaN(num)) patch[key] = num;
    }
  );

  return patch;
}
