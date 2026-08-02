import { api } from "@/lib/api";
import { safe } from "@/lib/safe";
import { PageHeader } from "@/components/shared/page-header";
import { MatchList } from "@/components/home/featured-sections";

export const revalidate = 60;

export default async function MatchesPage() {
  const resp = await safe(() => api.matches({ limit: 30 }), { total: 0, count: 0, matches: [] });

  return (
    <div>
      <PageHeader
        eyebrow="Matches"
        title="Fixtures & Results"
        description={`${resp.total || 0} matches recorded. Showing the most recent ${resp.matches.length}.`}
      />
      <MatchList matches={resp.matches} />
    </div>
  );
}
