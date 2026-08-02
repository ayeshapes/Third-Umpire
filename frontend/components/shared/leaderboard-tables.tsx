import Link from "next/link";
import { formatNumber } from "@/lib/utils";
import type { OrangeCapEntry, PurpleCapEntry } from "@/types/api";

export function OrangeCapTable({ entries }: { entries: OrangeCapEntry[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-fg-faint">
          <th className="pb-2 font-medium">Player</th>
          <th className="pb-2 font-medium text-right">Runs</th>
          <th className="pb-2 font-medium text-right">Avg</th>
          <th className="pb-2 font-medium text-right">SR</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((p, i) => (
          <tr key={p.player_id} className="border-b border-line/60 last:border-0">
            <td className="py-2.5">
              <Link href={`/players/${p.player_id}`} className="flex items-center gap-2 hover:text-crimson-bright">
                <span className="scoreboard-digits text-xs text-fg-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-ivory">{p.display_name ?? p.full_name}</span>
              </Link>
            </td>
            <td className="scoreboard-digits py-2.5 text-right text-ivory">{formatNumber(p.total_runs)}</td>
            <td className="scoreboard-digits py-2.5 text-right text-fg-muted">{p.average ?? "—"}</td>
            <td className="scoreboard-digits py-2.5 text-right text-fg-muted">{p.strike_rate ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PurpleCapTable({ entries }: { entries: PurpleCapEntry[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-fg-faint">
          <th className="pb-2 font-medium">Player</th>
          <th className="pb-2 font-medium text-right">Wkts</th>
          <th className="pb-2 font-medium text-right">Econ</th>
          <th className="pb-2 font-medium text-right">Overs</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((p, i) => (
          <tr key={p.player_id} className="border-b border-line/60 last:border-0">
            <td className="py-2.5">
              <Link href={`/players/${p.player_id}`} className="flex items-center gap-2 hover:text-amber">
                <span className="scoreboard-digits text-xs text-fg-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-ivory">{p.display_name ?? p.full_name}</span>
              </Link>
            </td>
            <td className="scoreboard-digits py-2.5 text-right text-ivory">{formatNumber(p.total_wickets)}</td>
            <td className="scoreboard-digits py-2.5 text-right text-fg-muted">{p.economy ?? "—"}</td>
            <td className="scoreboard-digits py-2.5 text-right text-fg-muted">{p.overs}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
