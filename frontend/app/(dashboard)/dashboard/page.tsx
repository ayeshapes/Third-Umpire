import { api } from "@/lib/api";
import { safe } from "@/lib/safe";
import { computeTeamForm } from "@/lib/team-form";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MatchesPerSeasonChart } from "@/components/charts/matches-per-season-chart";
import { OrangeCapTable, PurpleCapTable } from "@/components/shared/leaderboard-tables";
import { MatchList } from "@/components/home/featured-sections";
import { FeaturedInsights, InsightIcons } from "@/components/dashboard/featured-insights";
import { TrendingPlayers } from "@/components/dashboard/trending-players";
import { TrendingTeams } from "@/components/dashboard/trending-teams";
import { Activity, Users2, Shield, Target, Zap, Trophy } from "lucide-react";

export const revalidate = 60;

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-ivory">{title}</h3>
      <span className="h-px flex-1 bg-line" />
      <span className="text-[11px] font-medium uppercase tracking-widest text-fg-faint">{eyebrow}</span>
    </div>
  );
}

export default async function OverviewPage() {
  const [overview, matchesResp, leaderboard] = await Promise.all([
    safe(() => api.overview(), null),
    safe(() => api.matches({ limit: 357 }), { total: 0, count: 0, matches: [] }),
    safe(() => api.leaderboards(undefined, 8), { orange_cap: [], purple_cap: [] }),
  ]);

  const bySeasonMap = new Map<number, number>();
  for (const m of matchesResp.matches) {
    bySeasonMap.set(m.season_year, (bySeasonMap.get(m.season_year) ?? 0) + 1);
  }
  const perSeason = Array.from(bySeasonMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([season, matches]) => ({ season: String(season), matches }));

  const teamForm = computeTeamForm(matchesResp.matches);

  const topBowler = leaderboard.purple_cap[0];
  const insights = [
    overview?.strike_rate_leader
      ? {
          icon: InsightIcons.Flame,
          eyebrow: "Strike Rate Leader",
          headline: overview.strike_rate_leader.display_name ?? overview.strike_rate_leader.full_name,
          stat: String(overview.strike_rate_leader.strike_rate ?? "—"),
          statLabel: "career SR",
          blurb: "The fastest scorer in the league by career strike rate — sets the tempo whenever they're at the crease.",
          accent: "amber" as const,
        }
      : null,
    overview?.most_successful_team
      ? {
          icon: InsightIcons.Trophy,
          eyebrow: "Most Successful Team",
          headline: overview.most_successful_team.team_name,
          stat: `${overview.most_successful_team.win_pct?.toFixed(1) ?? "—"}%`,
          statLabel: "win rate",
          blurb: `${overview.most_successful_team.won} wins from ${overview.most_successful_team.played} matches played — the league's benchmark franchise.`,
          accent: "crimson" as const,
        }
      : null,
    topBowler
      ? {
          icon: InsightIcons.Crosshair,
          eyebrow: "Purple Cap Leader",
          headline: topBowler.display_name ?? topBowler.full_name,
          stat: String(topBowler.total_wickets),
          statLabel: "wickets",
          blurb: `Economy of ${topBowler.economy ?? "—"} across ${topBowler.innings} innings — the league's most dangerous bowler right now.`,
          accent: "crimson" as const,
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Overview"
        title="League Dashboard"
        description="League-wide totals, current leaderboards, and match volume across every recorded PSL season."
      />

      {/* Key Statistics */}
      <section>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Matches" value={overview?.total_matches ?? 0} icon={<Activity />} />
          <StatCard label="Players" value={overview?.total_players ?? 0} icon={<Users2 />} />
          <StatCard label="Teams" value={overview?.total_teams ?? 0} icon={<Shield />} />
          <StatCard label="Runs" value={overview?.total_runs ?? 0} icon={<Target />} />
          <StatCard label="Wickets" value={overview?.total_wickets ?? 0} icon={<Zap />} accent="amber" />
          <StatCard
            label="Best Win %"
            value={overview?.most_successful_team?.win_pct ?? 0}
            suffix="%"
            icon={<Trophy />}
            accent="amber"
            decimals={1}
          />
        </div>
      </section>

      {/* Featured Insights */}
      <section>
        <SectionHeading eyebrow="Storylines" title="Featured Insights" />
        {insights.length > 0 ? (
          <FeaturedInsights insights={insights} />
        ) : (
          <EmptyState title="Not enough data yet" description="Insights appear once enough matches have been recorded." />
        )}
      </section>

      {/* Trending Teams */}
      <section>
        <SectionHeading eyebrow="Standings" title="Trending Teams" />
        <TrendingTeams teams={teamForm} />
      </section>

      {/* Trending Players */}
      <section>
        <SectionHeading eyebrow="Form Guide" title="Trending Players" />
        <TrendingPlayers batters={leaderboard.orange_cap} bowlers={leaderboard.purple_cap} />
      </section>

      {/* Match volume + strike-rate detail */}
      <section>
        <SectionHeading eyebrow="Trends" title="Match Activity" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Matches Per Season</CardTitle>
            </CardHeader>
            <CardContent>
              {perSeason.length > 0 ? (
                <MatchesPerSeasonChart data={perSeason} />
              ) : (
                <EmptyState compact title="No season data yet" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Season Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              {overview?.strike_rate_leader ? (
                <div>
                  <p className="font-display text-2xl font-semibold text-ivory">
                    {overview.strike_rate_leader.display_name ?? overview.strike_rate_leader.full_name}
                  </p>
                  <p className="scoreboard-digits mt-2 text-4xl font-semibold text-amber">
                    {overview.strike_rate_leader.strike_rate ?? "—"}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-fg-faint">Career strike rate</p>
                </div>
              ) : (
                <EmptyState compact title="Not enough data yet" />
              )}
              <div className="mt-6 border-t border-line pt-4">
                <p className="text-xs uppercase tracking-widest text-fg-faint">Most Successful Team</p>
                <p className="mt-1 font-display text-lg font-semibold text-ivory">
                  {overview?.most_successful_team?.team_name ?? "—"}
                </p>
                <p className="text-xs text-fg-muted">
                  {overview?.most_successful_team
                    ? `${overview.most_successful_team.won} wins from ${overview.most_successful_team.played} matches`
                    : "Not enough data yet."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Leaderboards */}
      <section>
        <SectionHeading eyebrow="Season Caps" title="Leaderboards" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Orange Cap — Most Runs</CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.orange_cap.length > 0 ? (
                <OrangeCapTable entries={leaderboard.orange_cap} />
              ) : (
                <EmptyState compact title="No batting data yet" />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Purple Cap — Most Wickets</CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.purple_cap.length > 0 ? (
                <PurpleCapTable entries={leaderboard.purple_cap} />
              ) : (
                <EmptyState compact title="No bowling data yet" />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Recent matches */}
      <section>
        <SectionHeading eyebrow="Latest" title="Recent Matches" />
        <Card>
          <CardContent className="pt-5">
            {matchesResp.matches.length > 0 ? (
              <MatchList matches={matchesResp.matches.slice(0, 4)} />
            ) : (
              <EmptyState title="No matches recorded yet" />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
