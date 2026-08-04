"use client";

/**
 * Ticket 7.1 -- shared building block for the Season Overview and
 * Advanced KPI card grids. One small, reusable card: label + big
 * value + optional sublabel/trend, with its own loading (skeleton)
 * and empty (--) states so callers don't have to branch per-card --
 * they just pass `isLoading` and a possibly-null value.
 */

import type { ReactNode } from "react";

export interface StatCardProps {
  label: string;
  /** Pre-formatted display value, e.g. "1,284" or "138.4". Pass null/undefined for "no data". */
  value: ReactNode | null | undefined;
  sublabel?: string;
  isLoading?: boolean;
  /** Small accent icon/glyph rendered top-right, purely decorative. */
  accent?: ReactNode;
}

export function StatCard({ label, value, sublabel, isLoading, accent }: StatCardProps) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-line-strong bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-fg-faint">{label}</span>
        {accent && <span className="shrink-0 text-fg-faint">{accent}</span>}
      </div>

      {isLoading ? (
        <div role="status" aria-label={`Loading ${label.toLowerCase()}`} className="h-7 w-20 animate-pulse rounded bg-surface-2" />
      ) : (
        <span className="scoreboard-digits text-2xl font-semibold text-ivory">
          {value === null || value === undefined || value === "" ? "--" : value}
        </span>
      )}

      {sublabel && !isLoading && <span className="text-xs text-fg-faint">{sublabel}</span>}
    </div>
  );
}

/** Grid wrapper shared by both card sections -- keeps the responsive breakpoints in one place. */
export function StatCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}
