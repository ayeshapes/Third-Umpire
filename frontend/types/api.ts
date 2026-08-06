/**
 * Types mirroring the JSON shapes returned by backend/app/routers/*.
 * Field names match the SQL column / alias names exactly so there's no
 * translation layer between the database and the UI.
 */

export interface Overview {
  total_matches: number;
  total_players: number;
  total_teams: number;
  total_runs: number;
  total_wickets: number;
  strike_rate_leader: {
    player_id: number;
    display_name: string | null;
    full_name: string;
    strike_rate: number | null;
  } | null;
  most_successful_team: {
    team_id: number;
    team_name: string;
    played: number;
    won: number;
    win_pct: number | null;
  } | null;
}

export interface Season {
  season_id: number;
  season_year: number;
}

export interface Team {
  team_id: number;
  team_name: string;
  team_code: string;
}

export interface Match {
  match_id: number;
  season_year: number;
  match_date: string;
  match_number: number | null;
  stage: string | null;
  is_day_night: boolean | null;
  status: string | null;

  team1_id: number;
  team1_name: string;
  team1_code: string;
  team2_id: number;
  team2_name: string;
  team2_code: string;

  venue_name: string | null;
  city: string | null;

  toss_decision: string | null;
  toss_winner_name: string | null;

  winner_team_id: number | null;
  winner_name: string | null;
  win_margin_runs: number | null;
  win_margin_wickets: number | null;
  is_tie: boolean | null;
  decided_by_super_over: boolean | null;

  team1_runs: number | null;
  team1_wickets: number | null;
  team1_overs: number | null;
  team2_runs: number | null;
  team2_wickets: number | null;
  team2_overs: number | null;
}

export interface MatchesResponse {
  total: number;
  count: number;
  matches: Match[];
}

export interface PlayerSearchResult {
  player_id: number;
  full_name: string;
  display_name: string | null;
  nationality: string | null;
  primary_role: string | null;
  match_score?: number;
  // Total balls bowled / matches / 6, diluted across every match this
  // player has appeared in. See lib/player-role.ts's effectiveRoleLabel().
  // Optional: app/page.tsx builds a lightweight PlayerSearchResult-shaped
  // object from leaderboard data (to reuse <FeaturedPlayers>) that was
  // never fetched from /api/players/search and has no bowling stats.
  avg_overs_per_match?: number | null;
}

export interface TeamSearchResult {
  team_id: number;
  team_name: string;
  team_code: string;
  home_city: string | null;
  match_score?: number;
}

export interface VenueSearchResult {
  venue_id: number;
  venue_name: string;
  city: string | null;
  country: string | null;
  match_score?: number;
}

export interface PlayerFilterOptions {
  nationalities: string[];
  roles: string[];
}

export interface PlayerCompareEntry {
  player: {
    player_id: number;
    full_name: string;
    display_name: string | null;
    nationality: string | null;
    primary_role: string | null;
    batting_hand: string | null;
    bowling_arm: string | null;
    bowler_type: string | null;
  };
  batting: {
    innings: number;
    runs: number;
    average: number | null;
    strike_rate: number | null;
    boundary_pct: number | null;
    six_pct: number | null;
    balls_per_boundary: number | null;
    dot_ball_pct: number | null;
    fours: number;
    sixes: number;
  };
  bowling: {
    innings: number;
    wickets: number;
    economy: number | null;
    average: number | null;
    strike_rate: number | null;
    maidens: number;
  };
  catches: number;
  timeline: { season_year: number; runs: number; wickets: number }[];
}

export interface PlayerCompare {
  error?: string;
  player1: PlayerCompareEntry;
  player2: PlayerCompareEntry;
}

export interface PlayerDetail {
  player: {
    player_id: number;
    full_name: string;
    display_name: string | null;
    nationality: string | null;
    date_of_birth: string | null;
    primary_role: string | null;
    batting_hand: string | null;
    bowling_arm: string | null;
    bowler_type: string | null;
    bowling_subtype: string | null;
  };
  matches: number;
  batting: {
    innings: number;
    runs: number;
    highest_score: string | null;
    average: number | null;
    strike_rate: number | null;
    fifties: number;
    hundreds: number;
    fours: number;
    sixes: number;
  };
  bowling: {
    innings: number;
    overs: string | null;
    // Total balls bowled / matches / 6 -- diluted across every match
    // played, including ones this player didn't bowl in at all. Used by
    // lib/player-role.ts's effectiveRoleLabel() to decide whether to
    // show "Bowler" regardless of the DB's primary_role tag.
    avg_overs_per_match: number | null;
    wickets: number;
    best_figures: string | null;
    average: number | null;
    economy: number | null;
    maidens: number;
    four_wicket_hauls: number;
    five_wicket_hauls: number;
  };
}

export interface PlayerPhases {
  [key: string]: unknown;
}

export interface PlayerConsistency {
  [key: string]: unknown;
}

export interface Venue {
  venue_id: number;
  venue_name: string;
  city: string | null;
  country: string | null;
  boundary_length_m: number | null;
  latitude: number | null;
  longitude: number | null;
  match_count: number;
  avg_first_innings_score: number | null;
  boundary_pct_of_balls: number | null;
  spin_wicket_pct: number | null;
  chase_success_pct: number | null;
}

export interface VenueDetail {
  venue: Venue | { error: string };
  records: {
    highest_successful_chase: number | null;
    lowest_successful_chase: number | null;
    highest_successful_defense: number | null;
    lowest_successful_defense: number | null;
    total_runs_at_venue: number | null;
  } | null;
  recent_matches: Array<{
    match_id: number;
    season_year: number;
    match_date: string;
    stage: string | null;
    team1_name: string;
    team2_name: string;
    winner_name: string | null;
    win_margin_runs: number | null;
    win_margin_wickets: number | null;
    is_tie: boolean | null;
    team1_runs: number | null;
    team1_wickets: number | null;
    team2_runs: number | null;
    team2_wickets: number | null;
  }>;
}

export interface HeadToHead {
  record: {
    total_matches: number;
    team1_wins: number;
    team2_wins: number;
    ties: number;
    no_results: number;
  };
  venue_wins: {
    venue_id: number | null;
    venue_name: string | null;
    team1_wins: number;
    team2_wins: number;
    matches: number;
  }[];
  batting: {
    team1: TeamMatchupBatting | null;
    team2: TeamMatchupBatting | null;
  };
  bowling: {
    team1: TeamMatchupBowling | null;
    team2: TeamMatchupBowling | null;
  };
  recent_meetings: {
    match_id: number;
    season_year: number;
    match_date: string;
    stage: string;
    team1_name: string;
    team2_name: string;
    winner_name: string | null;
    win_margin_runs: number | null;
    win_margin_wickets: number | null;
    is_tie: boolean;
    venue_name: string | null;
    team1_runs: number | null;
    team1_wickets: number | null;
    team2_runs: number | null;
    team2_wickets: number | null;
  }[];
}

export interface TeamMatchupBatting {
  innings: number;
  average_score: number | null;
  highest_score: number | null;
  lowest_defended_score: number | null;
  chase_success_pct: number | null;
  fours: number;
  sixes: number;
  boundary_pct: number | null;
}

export interface TeamMatchupBowling {
  wickets: number;
  economy: number | null;
}

export interface OrangeCapEntry {
  player_id: number;
  display_name: string | null;
  full_name: string;
  total_runs: number;
  innings: number;
  average: number | null;
  strike_rate: number | null;
  hundreds: number;
  fifties: number;
}

export interface PurpleCapEntry {
  player_id: number;
  display_name: string | null;
  full_name: string;
  total_wickets: number;
  innings: number;
  overs: string;
  economy: number | null;
  average: number | null;
  four_wicket_hauls: number;
  five_wicket_hauls: number;
}

export interface LeaderboardResponse {
  orange_cap: OrangeCapEntry[];
  purple_cap: PurpleCapEntry[];
}

export interface TossImpact {
  overall: {
    total_matches: number;
    toss_winner_won: number;
    toss_winner_win_pct: number | null;
  };
  by_decision: Record<
    string,
    {
      matches: number;
      toss_winner_won: number;
      toss_winner_win_pct: number | null;
    }
  >;
}

export interface SeasonAward {
  [key: string]: unknown;
}

export interface MatchDetail {
  [key: string]: unknown;
}

export interface Matchup {
  [key: string]: unknown;
}

export interface PlayerOfMatchLeader {
  player_id?: number;
  full_name?: string;
  [key: string]: unknown;
}

export interface FieldingLeaderboardEntry {
  [key: string]: unknown;
}

export interface SeasonCompare {
  [key: string]: unknown;
}

export interface DayNightBucket {
  matches: number;
  avg_first_innings_score: number | null;
  chase_success_pct: number | null;
  batting: {
    innings: number;
    runs: number;
    average: number | null;
    strike_rate: number | null;
    fours: number;
    sixes: number;
  };
  bowling: {
    innings: number;
    wickets: number;
    economy: number | null;
    average: number | null;
  };
}

export interface DayNightSplit {
  day: DayNightBucket;
  night: DayNightBucket;
}

export interface PlayerVsBowlingTypeRow {
  [key: string]: unknown;
}

export interface BatterVsBowlingType {
  [key: string]: unknown;
}

export interface LeagueEvolutionPoint {
  season_year?: number;
  [key: string]: unknown;
}
