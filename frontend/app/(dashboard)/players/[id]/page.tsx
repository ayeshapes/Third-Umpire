import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { safe } from "@/lib/safe";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerRadarChart } from "@/components/charts/player-radar-chart";
import { formatDate } from "@/lib/utils";

export const revalidate = 60;

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  if (Number.isNaN(playerId)) notFound();

  const detail = await safe(() => api.player(playerId), null);
  if (!detail || "error" in (detail as unknown as Record<string, unknown>)) notFound();

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
          <div className="flex gap-2">
            {player.primary_role && <Badge variant="crimson">{player.primary_role}</Badge>}
            {player.date_of_birth && <Badge variant="outline">Born {formatDate(player.date_of_birth)}</Badge>}
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
