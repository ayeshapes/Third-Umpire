import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionEyebrow } from "@/components/home/stats-preview";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, formatNumber } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import type { Match, PlayerSearchResult, Team } from "@/types/api";

export function FeaturedPlayers({ players }: { players: PlayerSearchResult[] }) {
  if (players.length === 0) return null;
  return (
    <section className="border-b border-line py-16">
      <div className="mx-auto max-w-7xl px-6">
        <SectionEyebrow
          label="Featured Players"
          action={
            <Link href="/players" className="flex items-center gap-1 text-sm text-fg-muted hover:text-ivory">
              All players <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {players.slice(0, 6).map((p) => (
            <Link key={p.player_id} href={`/players/${p.player_id}`}>
              <Card className="group flex h-full flex-col items-center gap-3 p-5 text-center transition-colors hover:border-crimson-bright/40">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 font-display text-lg font-semibold text-fg-muted group-hover:text-crimson-bright">
                  {(p.display_name ?? p.full_name).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-ivory">{p.display_name ?? p.full_name}</p>
                  <p className="mt-0.5 text-xs text-fg-faint">{p.primary_role ?? p.nationality ?? "—"}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeaturedTeams({ teams }: { teams: Team[] }) {
  if (teams.length === 0) return null;
  return (
    <section className="border-b border-line py-16">
      <div className="mx-auto max-w-7xl px-6">
        <SectionEyebrow
          label="Featured Teams"
          action={
            <Link href="/teams" className="flex items-center gap-1 text-sm text-fg-muted hover:text-ivory">
              All teams <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {teams.slice(0, 6).map((t) => (
            <Link key={t.team_id} href={`/teams/${t.team_id}`}>
              <Card className="group flex flex-col items-center gap-2 p-5 text-center transition-colors hover:border-crimson-bright/40">
                <span className="font-display text-xl font-bold tracking-wide text-ivory group-hover:text-crimson-bright">
                  {t.team_code}
                </span>
                <span className="text-xs text-fg-faint">{t.team_name}</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MatchList({ matches }: { matches: Match[] }) {
  if (matches.length === 0) {
    return <EmptyState title="No matches to show" />;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {matches.map((m) => (
        <Card key={m.match_id} className="p-5">
          <div className="flex items-center justify-between text-xs text-fg-faint">
            <span>{formatDate(m.match_date)} · {m.stage ?? "League"}</span>
            <Badge variant="outline">{m.season_year}</Badge>
          </div>
          <div className="mt-3 space-y-2">
            <MatchRow name={m.team1_name} runs={m.team1_runs} wickets={m.team1_wickets} won={m.winner_team_id === m.team1_id} />
            <MatchRow name={m.team2_name} runs={m.team2_runs} wickets={m.team2_wickets} won={m.winner_team_id === m.team2_id} />
          </div>
          {m.winner_name && (
            <p className="mt-3 text-xs text-fg-muted">
              {m.winner_name} won
              {m.win_margin_runs ? ` by ${m.win_margin_runs} runs` : ""}
              {m.win_margin_wickets ? ` by ${m.win_margin_wickets} wickets` : ""}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

export function RecentMatches({ matches }: { matches: Match[] }) {
  if (matches.length === 0) return null;
  return (
    <section className="border-b border-line py-16">
      <div className="mx-auto max-w-7xl px-6">
        <SectionEyebrow
          label="Recent Matches"
          action={
            <Link href="/matches" className="flex items-center gap-1 text-sm text-fg-muted hover:text-ivory">
              All matches <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="mt-6">
          <MatchList matches={matches.slice(0, 4)} />
        </div>
      </div>
    </section>
  );
}

function MatchRow({ name, runs, wickets, won }: { name: string; runs: number | null; wickets: number | null; won: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={won ? "font-medium text-ivory" : "text-fg-muted"}>{name}</span>
      <span className="scoreboard-digits text-sm text-fg-muted">
        {runs !== null ? `${formatNumber(runs)}/${wickets ?? 0}` : "—"}
      </span>
    </div>
  );
}
