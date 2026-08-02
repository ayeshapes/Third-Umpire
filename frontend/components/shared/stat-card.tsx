"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  icon?: ReactNode;
  accent?: "crimson" | "amber";
  decimals?: number;
}

/**
 * The signature "scoreboard" element: a KPI card whose number counts up
 * like a stadium LED board resolving on a result, set in tabular-nums
 * monospace so digits don't jitter horizontally as they animate.
 */
export function StatCard({ label, value, suffix, icon, accent = "crimson", decimals = 0 }: StatCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 900;
    const start = performance.now();
    const from = 0;
    const to = value;
    let raf: number;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      <Card className="group relative overflow-hidden p-5 transition-colors hover:border-line-strong">
        <div
          className={cn(
            "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl transition-opacity opacity-0 group-hover:opacity-100",
            accent === "crimson" ? "bg-crimson/30" : "bg-amber/25"
          )}
        />
        <div className="flex items-center justify-between">
          <p className="font-display text-xs font-medium uppercase tracking-widest text-fg-muted">{label}</p>
          {icon ? (
            <span className={cn("[&>svg]:h-4 [&>svg]:w-4", accent === "crimson" ? "text-crimson-bright" : "text-amber")}>
              {icon}
            </span>
          ) : null}
        </div>
        <p
          className={cn(
            "scoreboard-digits mt-2 text-4xl font-semibold",
            accent === "crimson" ? "text-ivory" : "text-amber"
          )}
        >
          {display.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
          {suffix ? <span className="ml-1 text-lg text-fg-muted">{suffix}</span> : null}
        </p>
      </Card>
    </motion.div>
  );
}
