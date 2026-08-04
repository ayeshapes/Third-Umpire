import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionEyebrow } from "@/components/home/stats-preview";
import type { Season } from "@/types/api";

export function SeasonHighlights({ seasons }: { seasons: Season[] }) {
  if (seasons.length === 0) return null;
  return (
    <section className="border-b border-line py-16">
      <div className="mx-auto max-w-7xl px-6">
        <SectionEyebrow label="Season Highlights" />
        <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
          {seasons.slice(0, 8).map((s) => (
            <Link key={s.season_id} href={`/seasons?season_id=${s.season_id}`} className="shrink-0">
              <Card className="flex h-28 w-40 flex-col items-center justify-center gap-1 transition-colors hover:border-crimson-bright/40">
                <span className="scoreboard-digits text-3xl font-semibold text-ivory">{s.season_year}</span>
                <span className="text-xs uppercase tracking-widest text-fg-faint">Season</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TopRecordsTeaser() {
  const records = [
    { label: "Highest Team Score", href: "/records" },
    { label: "Most Career Runs", href: "/records" },
    { label: "Most Wickets", href: "/records" },
    { label: "Fastest Fifty", href: "/records" },
  ];
  return (
    <section className="border-b border-line py-16">
      <div className="mx-auto max-w-7xl px-6">
        <SectionEyebrow label="Top Records" />
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {records.map((r) => (
            <Link key={r.label} href={r.href}>
              <Card className="flex h-24 items-center justify-center px-4 text-center transition-colors hover:border-amber/40">
                <span className="text-sm font-medium text-ivory">{r.label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CallToAction() {
  return (
    <section className="floodlight border-b border-line py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-display text-3xl font-semibold uppercase tracking-tight text-ivory md:text-4xl">
          Every stat has a story.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-fg-muted">
          Dig into player form, venue conditions, and team rivalries across every PSL season.
        </p>
        <div className="mt-8">
          <Link href="/dashboard">
            <Button size="lg" variant="primary">Open the Dashboard</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-fg-faint md:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-crimson font-display text-[10px] font-bold text-on-crimson">
            TU
          </span>
          <span>Third Umpire — PSL Analytics Platform</span>
        </div>
        <p>Built on public ball-by-ball data. Not affiliated with the PSL.</p>
      </div>
    </footer>
  );
}
