import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

/**
 * The single empty-state pattern used across every page/section. Keeping
 * one component means "no data yet" always reads the same way, whether
 * it's an empty table, an empty chart, or a filtered list with no results.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  description,
  compact = false,
  className,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong text-center",
        compact ? "gap-2 px-6 py-8" : "gap-3 px-8 py-14",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-surface-2 text-fg-faint",
          compact ? "h-9 w-9" : "h-12 w-12"
        )}
      >
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
      </div>
      <div>
        <p className={cn("font-medium text-fg-muted", compact ? "text-xs" : "text-sm")}>{title}</p>
        {description && (
          <p className={cn("mt-1 max-w-xs text-fg-faint", compact ? "text-[11px]" : "text-xs")}>{description}</p>
        )}
      </div>
    </div>
  );
}
