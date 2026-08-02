import Link from "next/link";
import { api } from "@/lib/api";
import { safe } from "@/lib/safe";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Shield } from "lucide-react";

export const revalidate = 60;

export default async function TeamsPage() {
  const teams = await safe(() => api.teams(), []);

  return (
    <div>
      <PageHeader
        eyebrow="Teams"
        title="Franchises"
        description="Every PSL franchise — open a team to see its head-to-head record and season history."
      />

      {teams.length === 0 ? (
        <p className="py-16 text-center text-sm text-fg-faint">No team data available yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {teams.map((t) => (
            <Link key={t.team_id} href={`/teams/${t.team_id}`}>
              <Card className="group flex flex-col items-center gap-3 p-6 text-center transition-colors hover:border-crimson-bright/40">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-crimson-bright transition-colors group-hover:bg-crimson/15">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold uppercase tracking-wide text-ivory">
                    {t.team_code}
                  </p>
                  <p className="mt-0.5 text-xs text-fg-faint">{t.team_name}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
