"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export interface TeamForm {
  team_id: number;
  team_name: string;
  team_code: string;
  played: number;
  won: number;
  win_pct: number;
  form: ("W" | "L")[];
}

export function TrendingTeams({ teams }: { teams: TeamForm[] }) {
  if (teams.length === 0) {
    return <EmptyState title="No team form data yet" description="Team standings will appear once matches are recorded." />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {teams.slice(0, 4).map((t, i) => (
        <motion.div
          key={t.team_id}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.4, delay: i * 0.06 }}
        >
          <Link href={`/teams/${t.team_id}`}>
            <Card className="group flex h-full flex-col gap-4 p-5 transition-colors hover:border-crimson-bright/40">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold tracking-wide text-ivory group-hover:text-crimson-bright">
                    {t.team_code}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-fg-faint">{t.team_name}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    i === 0 ? "bg-amber/12 text-amber" : "bg-surface-2 text-fg-muted"
                  )}
                >
                  #{i + 1}
                </span>
              </div>

              <div>
                <p className="scoreboard-digits text-2xl font-semibold text-ivory">{t.win_pct.toFixed(1)}%</p>
                <p className="text-[11px] uppercase tracking-wide text-fg-faint">
                  {t.won}W from {t.played} played
                </p>
              </div>

              <div className="mt-auto flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-widest text-fg-faint">Form</span>
                <div className="flex gap-1">
                  {t.form.map((r, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                        r === "W" ? "bg-crimson/15 text-crimson-bright" : "bg-surface-2 text-fg-faint"
                      )}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
