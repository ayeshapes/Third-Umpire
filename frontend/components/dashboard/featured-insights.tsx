"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Flame, Trophy, Crosshair } from "lucide-react";

// Server Components (dashboard/page.tsx) can't import a plain object of
// icon components from this "use client" file and read properties off
// it -- across the RSC boundary that object is a client reference, not
// the real thing, so e.g. `InsightIcons.Flame` silently evaluates to
// undefined server-side. Passing a string key instead (resolved to the
// real component here, entirely client-side) avoids that trap.
const ICON_MAP = { flame: Flame, trophy: Trophy, crosshair: Crosshair } as const;
export type InsightIconKey = keyof typeof ICON_MAP;

interface Insight {
  icon: InsightIconKey;
  eyebrow: string;
  headline: string;
  stat: string;
  statLabel: string;
  blurb: string;
  accent: "crimson" | "amber";
}

export function FeaturedInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {insights.map((insight, i) => {
        const Icon = ICON_MAP[insight.icon];
        return (
        <motion.div
          key={insight.eyebrow}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.45, delay: i * 0.08 }}
        >
          <Card className="group relative h-full overflow-hidden p-6">
            <div
              className={cn(
                "pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                insight.accent === "crimson" ? "bg-crimson/20" : "bg-amber/20"
              )}
            />
            <div className="relative flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-widest text-fg-faint">{insight.eyebrow}</p>
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border",
                  insight.accent === "crimson"
                    ? "border-crimson/25 bg-crimson/10 text-crimson-bright"
                    : "border-amber/30 bg-amber/12 text-amber"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>

            <p className="relative mt-4 font-display text-xl font-semibold leading-tight text-ivory">
              {insight.headline}
            </p>

            <div className="relative mt-4 flex items-baseline gap-2">
              <span
                className={cn(
                  "scoreboard-digits text-3xl font-semibold",
                  insight.accent === "crimson" ? "text-ivory" : "text-amber"
                )}
              >
                {insight.stat}
              </span>
              <span className="text-xs uppercase tracking-wide text-fg-faint">{insight.statLabel}</span>
            </div>

            <p className="relative mt-3 text-xs leading-relaxed text-fg-muted">{insight.blurb}</p>
          </Card>
        </motion.div>
        );
      })}
    </div>
  );
}
