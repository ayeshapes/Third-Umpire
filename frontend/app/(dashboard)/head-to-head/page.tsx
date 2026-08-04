"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Handshake, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ComparisonBarChart } from "@/components/charts/comparison-bar-chart";
import { formatDate } from "@/lib/utils";
import type { HeadToHead, Team } from "@/types/api";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-fg-faint">{label}</p>
      <p className="scoreboard-digits mt-1 text-xl font-semibold text-ivory">{value}</p>
    </div>
  );
}

function fmt(v: number | null | undefined, suffix = "") {
  return v === null || v === undefined ? "—" : `${v}${suffix}`;
}

export default function HeadToHeadPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [team1, setTeam1] = useState<number | "">("");
  const [team2, setTeam2] = useState<number | "">("");
  const [data, setData] = useState<HeadToHead | null>(null);
  const [errored, setErrored] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    api.teams().then(setTeams).catch(() => setTeams([]));
  }, []);

  const bothSelected = Boolean(team1 && team2 && team1 !== team2);

  useEffect(() => {
    if (!bothSelected) return;
    startTransition(async () => {
      try {
        const result = await api.headToHead(Number(team1), Number(team2));
        setData(result);
        setErrored(false);
      } catch {
        setData(null);
        setErrored(true);
      }
    });
  }, [team1, team2, bothSelected]);

  const team1Name = teams.find((t) => t.team_id === team1)?.team_name ?? "Team A";
  const team2Name = teams.find((t) => t.team_id === team2)?.team_name ?? "Team B";

  const boundaryData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Fours", player1: data.batting.team1?.fours ?? 0, player2: data.batting.team2?.fours ?? 0 },
      { name: "Sixes", player1: data.batting.team1?.sixes ?? 0, player2: data.batting.team2?.sixes ?? 0 },
    ];
  }, [data]);

  const bowlingData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Wickets", player1: data.bowling.team1?.wickets ?? 0, player2: data.bowling.team2?.wickets ?? 0 },
      {
        name: "Economy",
        player1: data.bowling.team1?.economy ?? 0,
        player2: data.bowling.team2?.economy ?? 0,
      },
    ];
  }, [data]);

  const record = data?.record;
  const winPct1 =
    record && record.total_matches
      ? Math.round((record.team1_wins / record.total_matches) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Teams"
        title="Team Comparison"
        description="Pick two teams to compare their head-to-head record, venue history, and batting/bowling numbers."
      />

      <div className="flex flex-wrap items-center gap-3">
        <TeamSelect teams={teams} value={team1} onChange={setTeam1} placeholder="Team A" />
        <span className="font-display text-sm uppercase tracking-widest text-fg-faint">vs</span>
        <TeamSelect teams={teams} value={team2} onChange={setTeam2} placeholder="Team B" />
      </div>

      <div className="mt-8">
        {!team1 || !team2 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong py-20 text-center">
            <Handshake className="h-8 w-8 text-fg-faint" />
            <p className="mt-3 text-sm text-fg-muted">Choose two teams to see their comparison.</p>
          </div>
        ) : team1 === team2 ? (
          <p className="py-10 text-center text-sm text-fg-faint">Choose two different teams.</p>
        ) : isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-64" />
          </div>
        ) : errored || !data ? (
          <p className="py-10 text-center text-sm text-fg-faint">No head-to-head data found for these teams.</p>
        ) : (
          <div className="space-y-4">
            {/* Head-to-head + total wins */}
            <Card>
              <CardHeader>
                <CardTitle>Head-to-Head Record</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                  <Stat label={team1Name} value={record!.team1_wins} />
                  <Stat label={team2Name} value={record!.team2_wins} />
                  <Stat label="Ties" value={record!.ties} />
                  <Stat label="No Result" value={record!.no_results} />
                  <Stat label="Total Matches" value={record!.total_matches} />
                </div>
                <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full bg-crimson-bright"
                    style={{ width: `${record!.total_matches ? winPct1 : 50}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-fg-faint">
                  <span>{team1Name} — {winPct1}%</span>
                  <span>{team2Name} — {100 - winPct1}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Venue wins */}
            <Card>
              <CardHeader>
                <CardTitle>Venue Record</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {data.venue_wins.length === 0 ? (
                  <p className="p-5 text-sm text-fg-faint">No venue data available.</p>
                ) : (
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-widest text-fg-faint">
                        <th className="px-5 py-3 font-medium">Venue</th>
                        <th className="px-5 py-3 text-right font-medium text-crimson-bright">{team1Name}</th>
                        <th className="px-5 py-3 text-right font-medium text-[#b9862f]">{team2Name}</th>
                        <th className="px-5 py-3 text-right font-medium">Matches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.venue_wins.map((v, i) => (
                        <tr key={v.venue_id ?? i} className={i % 2 === 0 ? "" : "bg-surface-2/40"}>
                          <td className="flex items-center gap-1.5 px-5 py-2.5 text-fg-muted">
                            <MapPin className="h-3.5 w-3.5 text-fg-faint" />
                            {v.venue_name ?? "Unknown"}
                          </td>
                          <td className="scoreboard-digits px-5 py-2.5 text-right text-ivory">{v.team1_wins}</td>
                          <td className="scoreboard-digits px-5 py-2.5 text-right text-ivory">{v.team2_wins}</td>
                          <td className="scoreboard-digits px-5 py-2.5 text-right text-fg-muted">{v.matches}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Batting comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Batting Comparison</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-widest text-fg-faint">
                      <th className="px-5 py-3 font-medium">Metric</th>
                      <th className="px-5 py-3 text-right font-medium text-crimson-bright">{team1Name}</th>
                      <th className="px-5 py-3 text-right font-medium text-[#b9862f]">{team2Name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Average Score", fmt(data.batting.team1?.average_score), fmt(data.batting.team2?.average_score)],
                      ["Highest Total", fmt(data.batting.team1?.highest_score), fmt(data.batting.team2?.highest_score)],
                      [
                        "Lowest Defended Score",
                        fmt(data.batting.team1?.lowest_defended_score),
                        fmt(data.batting.team2?.lowest_defended_score),
                      ],
                      [
                        "Chase Success",
                        fmt(data.batting.team1?.chase_success_pct, "%"),
                        fmt(data.batting.team2?.chase_success_pct, "%"),
                      ],
                      ["Boundary %", fmt(data.batting.team1?.boundary_pct, "%"), fmt(data.batting.team2?.boundary_pct, "%")],
                    ].map(([label, v1, v2], i) => (
                      <tr key={label} className={i % 2 === 0 ? "" : "bg-surface-2/40"}>
                        <td className="px-5 py-2.5 text-fg-muted">{label}</td>
                        <td className="scoreboard-digits px-5 py-2.5 text-right text-ivory">{v1}</td>
                        <td className="scoreboard-digits px-5 py-2.5 text-right text-ivory">{v2}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Boundary Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ComparisonBarChart
                    data={boundaryData}
                    series={[
                      { key: "player1", color: "#3d6a7d", label: team1Name },
                      { key: "player2", color: "#b9862f", label: team2Name },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bowling Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ComparisonBarChart
                    data={bowlingData}
                    series={[
                      { key: "player1", color: "#3d6a7d", label: team1Name },
                      { key: "player2", color: "#b9862f", label: team2Name },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Recent meetings */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Meetings</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {data.recent_meetings.length === 0 ? (
                  <p className="p-5 text-sm text-fg-faint">No meetings recorded yet.</p>
                ) : (
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-widest text-fg-faint">
                        <th className="px-5 py-3 font-medium">Date</th>
                        <th className="px-5 py-3 font-medium">Venue</th>
                        <th className="px-5 py-3 font-medium">Score</th>
                        <th className="px-5 py-3 font-medium">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent_meetings.map((m, i) => (
                        <tr key={m.match_id} className={i % 2 === 0 ? "" : "bg-surface-2/40"}>
                          <td className="px-5 py-2.5 text-fg-muted">{formatDate(m.match_date)}</td>
                          <td className="px-5 py-2.5 text-fg-muted">{m.venue_name ?? "—"}</td>
                          <td className="scoreboard-digits px-5 py-2.5 text-ivory">
                            {m.team1_name} {m.team1_runs ?? "—"}/{m.team1_wickets ?? "—"} · {m.team2_name}{" "}
                            {m.team2_runs ?? "—"}/{m.team2_wickets ?? "—"}
                          </td>
                          <td className="px-5 py-2.5 text-fg-muted">
                            {m.is_tie
                              ? "Tied"
                              : m.winner_name
                              ? `${m.winner_name} won${
                                  m.win_margin_runs
                                    ? ` by ${m.win_margin_runs} runs`
                                    : m.win_margin_wickets
                                    ? ` by ${m.win_margin_wickets} wkts`
                                    : ""
                                }`
                              : "No result"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamSelect({
  teams,
  value,
  onChange,
  placeholder,
}: {
  teams: Team[];
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
      className="h-10 rounded-full border border-line-strong bg-surface px-4 text-sm text-ivory focus:outline-none focus:ring-2 focus:ring-crimson-bright/50"
    >
      <option value="">{placeholder}</option>
      {teams.map((t) => (
        <option key={t.team_id} value={t.team_id}>
          {t.team_name}
        </option>
      ))}
    </select>
  );
}
