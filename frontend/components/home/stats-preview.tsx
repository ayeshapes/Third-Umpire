import { StatCard } from "@/components/shared/stat-card";
import { Trophy, Users2, Shield, Activity, Target, Zap } from "lucide-react";

interface StatsPreviewProps {
  totalMatches: number;
  totalPlayers: number;
  totalTeams: number;
  totalRuns: number;
  totalWickets: number;
  topTeamWinPct: number;
}

export function StatsPreview(props: StatsPreviewProps) {
  return (
    <section className="border-b border-line py-16">
      <div className="mx-auto max-w-7xl px-6">
        <SectionEyebrow label="The League, In Numbers" />
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Matches" value={props.totalMatches} icon={<Activity />} />
          <StatCard label="Players" value={props.totalPlayers} icon={<Users2 />} />
          <StatCard label="Teams" value={props.totalTeams} icon={<Shield />} />
          <StatCard label="Runs Scored" value={props.totalRuns} icon={<Target />} />
          <StatCard label="Wickets Taken" value={props.totalWickets} icon={<Zap />} accent="amber" />
          <StatCard label="Best Win %" value={props.topTeamWinPct} suffix="%" icon={<Trophy />} accent="amber" decimals={1} />
        </div>
      </div>
    </section>
  );
}

export function SectionEyebrow({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-crimson-bright" />
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ivory md:text-xl">{label}</h2>
      </div>
      {action}
    </div>
  );
}
