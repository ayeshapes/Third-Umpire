import Link from "next/link";
import { api } from "@/lib/api";
import { safe } from "@/lib/safe";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { OrangeCapTable, PurpleCapTable } from "@/components/shared/leaderboard-tables";
import { formatNumber } from "@/lib/utils";
import type { FieldingLeaderboardEntry, PlayerOfMatchLeader } from "@/types/api";

export const revalidate = 60;

export default async function RecordsPage() {
  const [leaderboard, pomLeaders, fielding] = await Promise.all([
    safe(() => api.leaderboards(undefined, 10), { orange_cap: [], purple_cap: [] }),
    safe(() => api.playerOfMatchLeaders(), [] as PlayerOfMatchLeader[]),
    safe(() => api.fieldingLeaderboard(), [] as FieldingLeaderboardEntry[]),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Records"
        title="All-Time Records"
        description="Career leaderboards across every recorded PSL season — runs, wickets, fielding, and match-winning performances."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orange Cap — Most Career Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <OrangeCapTable entries={leaderboard.orange_cap} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Purple Cap — Most Career Wickets</CardTitle>
          </CardHeader>
          <CardContent>
            <PurpleCapTable entries={leaderboard.purple_cap} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most Player-of-the-Match Awards</CardTitle>
          </CardHeader>
          <CardContent>
            {pomLeaders.length === 0 ? (
              <p className="py-6 text-center text-sm text-fg-faint">No data available.</p>
            ) : (
              <ol className="space-y-2.5">
                {pomLeaders.slice(0, 10).map((p, i) => (
                  <li key={p.player_id ?? i} className="flex items-center justify-between border-b border-line/60 pb-2.5 last:border-0">
                    <Link
                      href={p.player_id ? `/players/${p.player_id}` : "#"}
                      className="flex items-center gap-2 text-sm hover:text-crimson-bright"
                    >
                      <span className="scoreboard-digits text-xs text-fg-faint">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-ivory">{p.full_name ?? "Unknown"}</span>
                    </Link>
                    <span className="scoreboard-digits text-sm text-amber">
                      {formatNumber(Number(p.awards ?? p.count ?? 0))}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fielding Leaderboard — Most Catches</CardTitle>
          </CardHeader>
          <CardContent>
            {fielding.length === 0 ? (
              <p className="py-6 text-center text-sm text-fg-faint">No data available.</p>
            ) : (
              <ol className="space-y-2.5">
                {fielding.slice(0, 10).map((f, i) => (
                  <li key={i} className="flex items-center justify-between border-b border-line/60 pb-2.5 last:border-0 text-sm">
                    <span className="flex items-center gap-2 text-ivory">
                      <span className="scoreboard-digits text-xs text-fg-faint">{String(i + 1).padStart(2, "0")}</span>
                      {String(f.full_name ?? f.display_name ?? "Unknown")}
                    </span>
                    <span className="scoreboard-digits text-amber">{formatNumber(Number(f.catches ?? 0))}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
