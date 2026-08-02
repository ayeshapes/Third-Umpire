import { api } from "@/lib/api";
import { safe } from "@/lib/safe";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MatchesPerSeasonChart } from "@/components/charts/matches-per-season-chart";
import { OrangeCapTable, PurpleCapTable } from "@/components/shared/leaderboard-tables";
import { MatchList } from "@/components/home/featured-sections";
import { Activity, Users2, Shield, Target, Zap, Trophy } from "lucide-react";

export const revalidate = 60;

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

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="League Dashboard"
        description="League-wide totals, current leaderboards, and match volume across every recorded PSL season."
      />

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

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Matches Per Season</CardTitle>
          </CardHeader>
          <CardContent>
            <MatchesPerSeasonChart data={perSeason} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strike Rate Leader</CardTitle>
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
              <p className="text-sm text-fg-faint">Not enough data yet.</p>
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orange Cap — Most Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <OrangeCapTable entries={leaderboard.orange_cap} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Purple Cap — Most Wickets</CardTitle>
          </CardHeader>
          <CardContent>
            <PurpleCapTable entries={leaderboard.purple_cap} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <MatchList matches={matchesResp.matches.slice(0, 4)} />
        </CardContent>
      </Card>
    </div>
  );
}
