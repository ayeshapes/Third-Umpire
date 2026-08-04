"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Flame, Trophy, Crosshair, type LucideIcon } from "lucide-react";

interface Insight {
  icon: LucideIcon;
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
      {insights.map((insight, i) => (
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
                <insight.icon className="h-4 w-4" />
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
      ))}
    </div>
  );
}

export const InsightIcons = { Flame, Trophy, Crosshair };
