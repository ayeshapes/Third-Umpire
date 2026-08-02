"use client";

import { useEffect, useState, useTransition } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Handshake } from "lucide-react";
import type { HeadToHead, Team } from "@/types/api";

export default function HeadToHeadPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [team1, setTeam1] = useState<number | "">("");
  const [team2, setTeam2] = useState<number | "">("");
  const [data, setData] = useState<HeadToHead | null>(null);
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
      } catch {
        setData(null);
      }
    });
  }, [team1, team2, bothSelected]);

  return (
    <div>
      <PageHeader
        eyebrow="Head-to-Head"
        title="Team Rivalries"
        description="Pick two teams to compare their full head-to-head record."
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
            <p className="mt-3 text-sm text-fg-muted">Choose two teams to see their head-to-head record.</p>
          </div>
        ) : team1 === team2 ? (
          <p className="py-10 text-center text-sm text-fg-faint">Choose two different teams.</p>
        ) : isPending ? (
          <Skeleton className="h-64" />
        ) : data ? (
          <Card>
            <CardHeader>
              <CardTitle>Record</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-ivory">
                {JSON.stringify(data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ) : (
          <p className="py-10 text-center text-sm text-fg-faint">No head-to-head data found for these teams.</p>
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
