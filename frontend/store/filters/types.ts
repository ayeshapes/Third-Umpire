/**
 * Type-safe shape for the app-wide analytics filter state.
 *
 * Every field is a single selected value (or null for "not set") --
 * this store answers "what one season/team/venue/etc am I looking at
 * right now", the same scoping used across Players, Teams, Matches,
 * Records, and Head-to-Head. It is deliberately separate from
 * GlobalFilterBar's generic multi-select `FilterValue` (groupId ->
 * string[]), which is a UI component concern, not app state -- a page
 * can still use GlobalFilterBar's chips/popover UI and write into this
 * store's setters underneath.
 *
 * IDs are stored as strings (not number) so every field has one
 * consistent, JSON/URL-safe type -- components that need a number can
 * `Number(filters.season)` at the point of use.
 */

/** Which side won the toss / what they elected to do. */
export type TossDecision = "bat" | "bowl";

/** Match result relative to whichever team/player is currently selected. */
export type ResultOutcome = "won" | "lost" | "tied" | "no_result";

/** Which innings of the match. */
export type InningsNumber = 1 | 2;

/** Phase of an innings. Ticket 6.8 labels: Powerplay / Middle overs / Death overs. */
export type MatchPhase = "powerplay" | "middle" | "death";

/** Ticket 6.8 -- Advanced Filter Categories. */

/** Prevailing weather condition during the match. */
export type WeatherCondition = "clear" | "cloudy" | "overcast" | "rain" | "humid" | "windy";

/** Whether the match was played under natural light, floodlights, or both. */
export type DayNight = "day" | "day_night" | "night";

/** Whether the currently-selected team (see `team`) batted first or chased. */
export type BattingOrder = "batting_first" | "chasing";

export interface FilterState {
  season: string | null;
  team: string | null;
  player: string | null;
  venue: string | null;
  /** Specific match (match_id), the last link in the Ticket 6.7 cascade: season -> team -> player -> venue -> match. */
  match: string | null;
  city: string | null;
  opponent: string | null;
  toss: TossDecision | null;
  result: ResultOutcome | null;
  innings: InningsNumber | null;
  phase: MatchPhase | null;

  /* ---- Ticket 6.8: Advanced Filter Categories ------------------- */
  /** Team that won the toss (team code -- same universe as `team`/`opponent`). */
  tossWinner: string | null;
  /** Whether the selected team batted first or chased. */
  battingOrder: BattingOrder | null;
  /** Day / Day-Night / Night match. */
  dayNight: DayNight | null;
  /** Weather condition at the venue. */
  weather: WeatherCondition | null;
  /** Temperature range, in Celsius. */
  temperatureMin: number | null;
  temperatureMax: number | null;
  /** Relative humidity range, in percent. */
  humidityMin: number | null;
  humidityMax: number | null;
  /** Wind speed range, in km/h. */
  windSpeedMin: number | null;
  windSpeedMax: number | null;
}

/** Every key of FilterState -- the single place a new filter is registered. */
export type FilterKey = keyof FilterState;
