import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "crimson" | "amber" | "outline";

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-surface-2 text-fg-muted border border-line",
    crimson: "bg-crimson/15 text-crimson-bright border border-crimson/30",
    amber: "bg-amber/15 text-amber border border-amber/30",
    outline: "border border-line-strong text-ivory bg-transparent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
