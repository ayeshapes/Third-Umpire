import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-crimson-bright">{eyebrow}</p>
        )}
        <h2 className="font-display text-2xl font-semibold uppercase tracking-tight text-ivory md:text-3xl">
          {title}
        </h2>
        {description && <p className="mt-1.5 max-w-xl text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        "floodlight flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong p-12 text-center"
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line-strong bg-surface">
        <Icon className="h-7 w-7 text-crimson-bright" />
      </div>
      <h3 className="mt-6 font-display text-xl font-semibold uppercase tracking-wide text-ivory">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-fg-muted">{description}</p>
      <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 text-xs font-medium uppercase tracking-widest text-fg-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-amber" />
        Coming soon
      </span>
    </div>
  );
}
