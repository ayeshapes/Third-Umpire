import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { safe } from "@/lib/safe";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MatchList } from "@/components/home/featured-sections";
import { formatNumber } from "@/lib/utils";

export const revalidate = 60;

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teamId = Number(id);
  if (Number.isNaN(teamId)) notFound();

  const [teams, matchesResp] = await Promise.all([
    safe(() => api.teams(), []),
    safe(() => api.matches({ team_id: teamId, limit: 357 }), { total: 0, count: 0, matches: [] }),
  ]);

  const team = teams.find((t) => t.team_id === teamId);
  if (!team) notFound();

  const played = matchesResp.matches.filter((m) => m.status !== "abandoned").length;
  const won = matchesResp.matches.filter((m) => m.winner_team_id === teamId).length;
  const winPct = played > 0 ? ((won / played) * 100).toFixed(1) : "—";

  const seasons = new Set(matchesResp.matches.map((m) => m.season_year));

  return (
    <div>
      <PageHeader eyebrow="Team" title={team.team_name} description={`Team code ${team.team_code}`} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-widest text-fg-faint">Matches Played</p>
          <p className="scoreboard-digits mt-1 text-3xl font-semibold text-ivory">{formatNumber(played)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-widest text-fg-faint">Wins</p>
          <p className="scoreboard-digits mt-1 text-3xl font-semibold text-ivory">{formatNumber(won)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-widest text-fg-faint">Win %</p>
          <p className="scoreboard-digits mt-1 text-3xl font-semibold text-amber">{winPct}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-widest text-fg-faint">Seasons Played</p>
          <p className="scoreboard-digits mt-1 text-3xl font-semibold text-ivory">{seasons.size}</p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent Fixtures</CardTitle>
        </CardHeader>
        <CardContent>
          <MatchList matches={matchesResp.matches.slice(0, 6)} />
        </CardContent>
      </Card>
    </div>
  );
}
