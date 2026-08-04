/**
 * Derives per-team played/won/win% and a recent W/L form strip from a list
 * of matches the caller has already fetched (dashboard's Trending Teams
 * section). No dedicated standings endpoint exists, and this only needs
 * fields already present on `Match`, so it's cheaper and always in sync
 * with the same match list rendered elsewhere on the page.
 */
import type { Match } from "@/types/api";
import type { TeamForm } from "@/components/dashboard/trending-teams";

const MIN_PLAYED = 5;
const FORM_LENGTH = 5;

export function computeTeamForm(matches: Match[]): TeamForm[] {
  const byTeam = new Map<
    number,
    { team_id: number; team_name: string; team_code: string; played: number; won: number; recent: { date: string; result: "W" | "L" }[] }
  >();

  function ensure(id: number, name: string, code: string) {
    if (!byTeam.has(id)) {
      byTeam.set(id, { team_id: id, team_name: name, team_code: code, played: 0, won: 0, recent: [] });
    }
    return byTeam.get(id)!;
  }

  for (const m of matches) {
    if (!m.winner_team_id) continue; // skip no-result / upcoming matches

    const t1 = ensure(m.team1_id, m.team1_name, m.team1_code);
    t1.played += 1;
    const t1won = m.winner_team_id === m.team1_id;
    if (t1won) t1.won += 1;
    t1.recent.push({ date: m.match_date, result: t1won ? "W" : "L" });

    const t2 = ensure(m.team2_id, m.team2_name, m.team2_code);
    t2.played += 1;
    const t2won = m.winner_team_id === m.team2_id;
    if (t2won) t2.won += 1;
    t2.recent.push({ date: m.match_date, result: t2won ? "W" : "L" });
  }

  return Array.from(byTeam.values())
    .filter((t) => t.played >= MIN_PLAYED)
    .map((t) => ({
      team_id: t.team_id,
      team_name: t.team_name,
      team_code: t.team_code,
      played: t.played,
      won: t.won,
      win_pct: (t.won / t.played) * 100,
      form: t.recent
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-FORM_LENGTH)
        .map((r) => r.result),
    }))
    .sort((a, b) => b.win_pct - a.win_pct);
}
