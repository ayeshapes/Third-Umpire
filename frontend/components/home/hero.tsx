"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TickerItem {
  label: string;
  value: string;
}

export function Hero({ ticker }: { ticker: TickerItem[] }) {
  return (
    <section className="floodlight relative overflow-hidden border-b border-line">
      {/* stadium-inspired ambient graphic: concentric floodlight rings */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <svg className="absolute -right-40 -top-40 h-[560px] w-[560px]" viewBox="0 0 400 400" fill="none">
          {[60, 110, 160, 210].map((r) => (
            <circle key={r} cx="200" cy="200" r={r} stroke="rgba(169,117,44,0.14)" strokeWidth="1" fill="none" />
          ))}
        </svg>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(41,30,20,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(41,30,20,0.035)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-20 md:pb-28 md:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 text-xs font-medium uppercase tracking-widest text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-crimson-bright" />
            Pakistan Super League Analytics Platform
          </span>

          <h1 className="font-display text-6xl font-semibold uppercase leading-[0.92] tracking-tight text-ivory sm:text-7xl md:text-8xl">
            Third <span className="text-crimson">Umpire</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-fg-muted md:text-lg">
            Every run, wicket, and decision from every PSL season — turned into player
            profiles, venue conditions, and head-to-head records you can actually query.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard">
              <Button size="lg" variant="primary">
                Explore Analytics <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/players">
              <Button size="lg" variant="outline">
                <Users className="h-4 w-4" /> View Players
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* scoreboard ticker -- signature element */}
      {ticker.length > 0 && (
        <div className="relative border-t border-line bg-surface/60">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-4">
            {ticker.map((item) => (
              <div key={item.label} className="flex items-baseline gap-2">
                <span className="scoreboard-digits text-lg font-semibold text-amber">{item.value}</span>
                <span className="text-xs uppercase tracking-widest text-fg-muted">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
