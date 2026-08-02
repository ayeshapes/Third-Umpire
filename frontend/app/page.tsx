import { api } from "@/lib/api";
import { safe } from "@/lib/safe";
import { formatNumber } from "@/lib/utils";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Hero } from "@/components/home/hero";
import { StatsPreview } from "@/components/home/stats-preview";
import { FeaturedPlayers, FeaturedTeams, RecentMatches } from "@/components/home/featured-sections";
import { SeasonHighlights, TopRecordsTeaser, CallToAction, Footer } from "@/components/home/misc-sections";

export const revalidate = 60;

export default async function HomePage() {
  const [overview, seasons, teams, matchesResp, leaderboard] = await Promise.all([
    safe(() => api.overview(), null),
    safe(() => api.seasons(), []),
    safe(() => api.teams(), []),
    safe(() => api.matches({ limit: 4 }), { total: 0, count: 0, matches: [] }),
    safe(() => api.leaderboards(undefined, 6), { orange_cap: [], purple_cap: [] }),
  ]);

  const ticker = overview
    ? [
        { label: "Matches", value: formatNumber(overview.total_matches) },
        { label: "Players", value: formatNumber(overview.total_players) },
        { label: "Runs Scored", value: formatNumber(overview.total_runs) },
        { label: "Wickets", value: formatNumber(overview.total_wickets) },
      ]
    : [];

  const featuredPlayers = leaderboard.orange_cap.map((p) => ({
    player_id: p.player_id,
    full_name: p.full_name,
    display_name: p.display_name,
    nationality: null,
    primary_role: `${formatNumber(p.total_runs)} runs`,
  }));

  return (
    <div className="min-h-screen bg-void">
      <PublicNavbar />
      <Hero ticker={ticker} />
      <StatsPreview
        totalMatches={overview?.total_matches ?? 0}
        totalPlayers={overview?.total_players ?? 0}
        totalTeams={overview?.total_teams ?? teams.length}
        totalRuns={overview?.total_runs ?? 0}
        totalWickets={overview?.total_wickets ?? 0}
        topTeamWinPct={overview?.most_successful_team?.win_pct ?? 0}
      />
      <FeaturedPlayers players={featuredPlayers} />
      <FeaturedTeams teams={teams} />
      <SeasonHighlights seasons={seasons} />
      <RecentMatches matches={matchesResp.matches} />
      <TopRecordsTeaser />
      <CallToAction />
      <Footer />
    </div>
  );
}
