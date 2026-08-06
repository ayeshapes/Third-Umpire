import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MatchList } from "@/components/home/featured-sections";
import { formatNumber } from "@/lib/utils";

// Team profiles are looked up individually and can be corrected at the
// data level at any time -- staleness here is confusing, not a meaningful
// perf win, so always fetch fresh (same reasoning as players/[id]).
export const dynamic = "force-dynamic";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teamId = Number(id);
  if (Number.isNaN(teamId)) notFound();

  // Deliberately NOT using the safe() wrapper here: safe() swallows every
  // failure (network error, 500, timeout, DB hiccup) into an empty-list
  // fallback, and this page used to treat that identically to "team
  // doesn't exist" (an empty list can never .find() a match) -- so a
  // transient backend issue rendered as a hard 404 for a team who's
  // really there. There's no single-team backend endpoint (only the full
  // /api/teams list + /api/matches), so we can't distinguish "not found"
  // from "backend error" via a response shape the way players/venues do --
  // instead, a thrown error from either call is treated as a load failure,
  // and only a *successful* fetch with no matching id is a genuine 404.
  let teams, matchesResp;
  try {
    [teams, matchesResp] = await Promise.all([
      api.teams(),
      api.matches({ team_id: teamId, limit: 357 }),
    ]);
  } catch {
    return <TeamLoadError />;
  }

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

function TeamLoadError() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-surface px-6 py-16 text-center">
      <TriangleAlert className="h-8 w-8 text-crimson-bright" />
      <p className="text-lg font-semibold text-ivory">Couldn&apos;t load this team right now</p>
      <p className="max-w-sm text-sm text-fg-muted">
        The backend didn&apos;t respond -- this is likely a temporary issue, not a missing team. Try refreshing the page.
      </p>
    </div>
  );
}
