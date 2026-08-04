/**
 * Typed client for the ThirdUmpire FastAPI backend.
 *
 * Every function here maps 1:1 to a route in backend/app/routers/*.
 * Keep this file as the single place that knows about endpoint paths --
 * pages and components should call these functions, never fetch() directly.
 */
import type {
  BatterVsBowlingType,
  DayNightSplit,
  FieldingLeaderboardEntry,
  HeadToHead,
  LeaderboardResponse,
  LeagueEvolutionPoint,
  MatchDetail,
  MatchesResponse,
  Matchup,
  Overview,
  PlayerCompare,
  PlayerConsistency,
  PlayerDetail,
  PlayerFilterOptions,
  PlayerPhases,
  PlayerOfMatchLeader,
  PlayerSearchResult,
  Season,
  SeasonAward,
  SeasonCompare,
  Team,
  TeamSearchResult,
  TossImpact,
  Venue,
  VenueDetail,
  VenueSearchResult,
} from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(path, API_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  const res = await fetch(url.toString(), {
    // Dashboard data changes as new matches are scraped/loaded, not on every
    // request -- a short revalidation window keeps pages fast without
    // serving stale season/leaderboard data for too long.
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  overview: () => request<Overview>("/api/overview"),

  seasons: () => request<Season[]>("/api/seasons"),
  seasonAwards: (seasonId: number) => request<SeasonAward>("/api/season-awards", { season_id: seasonId }),
  seasonsCompare: (seasonIdA: number, seasonIdB: number) =>
    request<SeasonCompare>("/api/seasons/compare", { season_id_a: seasonIdA, season_id_b: seasonIdB }),
  leagueEvolution: () => request<LeagueEvolutionPoint[]>("/api/league-evolution"),

  teams: () => request<Team[]>("/api/teams"),
  teamsSearch: (q?: string, limit?: number) => request<TeamSearchResult[]>("/api/teams/search", { q, limit }),
  headToHead: (team1Id: number, team2Id: number) =>
    request<HeadToHead>("/api/teams/head-to-head", { team1_id: team1Id, team2_id: team2Id }),

  matches: (params?: { season_id?: number; team_id?: number; stage?: string; limit?: number; offset?: number }) =>
    request<MatchesResponse>("/api/matches", params),
  matchDetail: (matchId: number) => request<MatchDetail>(`/api/matches/${matchId}/detail`),
  matchup: (team1Id: number, team2Id: number, venueId?: number) =>
    request<Matchup>("/api/matchup", { team1_id: team1Id, team2_id: team2Id, venue_id: venueId }),

  playersSearch: (
    q?: string,
    filters?: { nationality?: string; team_id?: number; role?: string; limit?: number }
  ) => request<PlayerSearchResult[]>("/api/players/search", { q, ...filters }),
  playerFilters: () => request<PlayerFilterOptions>("/api/players/filters"),
  player: (playerId: number) => request<PlayerDetail>(`/api/players/${playerId}`),
  playerPhases: (playerId: number) => request<PlayerPhases>(`/api/players/${playerId}/phases`),
  playerConsistency: (playerId: number) => request<PlayerConsistency>(`/api/players/${playerId}/consistency`),
  playersCompare: (player1Id: number, player2Id: number) =>
    request<PlayerCompare>("/api/players/compare", { player1_id: player1Id, player2_id: player2Id }),

  venues: () => request<Venue[]>("/api/venues"),
  venuesSearch: (q?: string, filters?: { city?: string; limit?: number }) =>
    request<VenueSearchResult[]>("/api/venues/search", { q, ...filters }),
  venue: (venueId: number) => request<VenueDetail>(`/api/venues/${venueId}`),

  leaderboards: (seasonId?: number, limit?: number) =>
    request<LeaderboardResponse>("/api/leaderboards", { season_id: seasonId, limit }),
  playerOfMatchLeaders: () => request<PlayerOfMatchLeader[]>("/api/player-of-match-leaders"),
  fieldingLeaderboard: () => request<FieldingLeaderboardEntry[]>("/api/fielding-leaderboard"),

  tossImpact: () => request<TossImpact>("/api/toss-impact"),
  dayNightSplit: () => request<DayNightSplit>("/api/day-night-split"),
  batterVsBowlingType: (playerId?: number) =>
    request<BatterVsBowlingType>("/api/batter-vs-bowling-type", { player_id: playerId }),
  dataQuality: () => request<Record<string, unknown>>("/api/data-quality"),
};

export { ApiError };
