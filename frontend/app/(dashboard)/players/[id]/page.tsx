import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerRadarChart } from "@/components/charts/player-radar-chart";
import { formatDate } from "@/lib/utils";

// Player profiles are looked up individually and can be corrected at the
// data level at any time (e.g. a mis-tagged primary_role) -- staleness
// here is confusing, not a meaningful perf win, so always fetch fresh.
export const dynamic = "force-dynamic";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  if (Number.isNaN(playerId)) notFound();

  // Deliberately NOT using the safe() wrapper here: safe() swallows every
  // failure (network error, 500, timeout, DB hiccup) into the same `null`
  // fallback, and this page used to treat that identically to "player
  // doesn't exist" -- so a transient backend issue rendered as a hard
  // "this page could not be found" 404 for a player who's really there.
  // We only want notFound() for the genuine case (backend responds with
  // {error: "player not found"}); anything else should show as an actual
  // error the person can retry, not a false 404.
  let detail;
  try {
    detail = await api.player(playerId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    return <PlayerLoadError />;
  }
  if ("error" in (detail as unknown as Record<string, unknown>)) notFound();

  const { player, batting, bowling } = detail;

  const radarData = [
    { metric: "Average", value: clamp(((batting.average ?? 0) / 50) * 100) },
    { metric: "Strike Rate", value: clamp(((batting.strike_rate ?? 0) / 180) * 100) },
    { metric: "Fours", value: clamp(((batting.fours ?? 0) / 200) * 100) },
    { metric: "Sixes", value: clamp(((batting.sixes ?? 0) / 100) * 100) },
    { metric: "Fifties", value: clamp(((batting.fifties ?? 0) / 20) * 100) },
    { metric: "Hundreds", value: clamp(((batting.hundreds ?? 0) / 5) * 100) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={player.primary_role ?? "Player"}
        title={player.display_name ?? player.full_name}
        description={[player.nationality, player.batting_hand, player.bowler_type]
          .filter(Boolean)
          .join(" · ") || undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {player.primary_role && <Badge variant="crimson">{player.primary_role}</Badge>}
            {player.date_of_birth && <Badge variant="outline">Born {formatDate(player.date_of_birth)}</Badge>}
            <Link
              href={`/players/compare?p1=${player.player_id}`}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ivory transition-colors hover:border-crimson-bright/50 hover:text-crimson-bright"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Compare
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Batting</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat label="Innings" value={batting.innings} />
            <Stat label="Runs" value={batting.runs} />
            <Stat label="Highest Score" value={batting.highest_score ?? "—"} />
            <Stat label="Average" value={batting.average ?? "—"} />
            <Stat label="Strike Rate" value={batting.strike_rate ?? "—"} />
            <Stat label="50s / 100s" value={`${batting.fifties} / ${batting.hundreds}`} />
            <Stat label="Fours" value={batting.fours} />
            <Stat label="Sixes" value={batting.sixes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bowling</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat label="Innings" value={bowling.innings} />
            <Stat label="Wickets" value={bowling.wickets} />
            <Stat label="Best Figures" value={bowling.best_figures ?? "—"} />
            <Stat label="Overs" value={bowling.overs ?? "—"} />
            <Stat label="Average" value={bowling.average ?? "—"} />
            <Stat label="Economy" value={bowling.economy ?? "—"} />
            <Stat label="4W / 5W" value={`${bowling.four_wicket_hauls} / ${bowling.five_wicket_hauls}`} />
            <Stat label="Maidens" value={bowling.maidens} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <PlayerRadarChart data={radarData} />
            <p className="mt-2 text-center text-[11px] text-fg-faint">Normalized against typical PSL top-order benchmarks</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-fg-faint">{label}</p>
      <p className="scoreboard-digits mt-1 text-xl font-semibold text-ivory">{value}</p>
    </div>
  );
}

function PlayerLoadError() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-surface px-6 py-16 text-center">
      <TriangleAlert className="h-8 w-8 text-crimson-bright" />
      <p className="text-lg font-semibold text-ivory">Couldn&apos;t load this player right now</p>
      <p className="max-w-sm text-sm text-fg-muted">
        The backend didn&apos;t respond -- this is likely a temporary issue, not a missing player. Try refreshing the page.
      </p>
    </div>
  );
}
