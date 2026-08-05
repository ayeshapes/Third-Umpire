"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeftRight, Search, Users } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlayerSearchResult } from "@/types/api";

export default function PlayersPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const isActiveQuery = query.trim().length >= 2;

  useEffect(() => {
    if (!isActiveQuery) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        try {
          const data = await api.playersSearch(query.trim());
          setResults(data);
          setSearchError(null);
        } catch (err) {
          // Distinguish "search failed" (backend/DB error) from "genuinely
          // no matches" -- silently treating both as empty results is what
          // made a broken search look identical to a normal empty state.
          setResults([]);
          setSearchError(err instanceof Error ? err.message : "Search failed. Please try again.");
        } finally {
          setSearched(true);
        }
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [query, isActiveQuery]);

  return (
    <div>
      <PageHeader
        eyebrow="Players"
        title="Player Search"
        description="Search the full PSL player pool by name to open a career profile — batting, bowling, and form."
        action={
          <Link
            href="/players/compare"
            className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ivory transition-colors hover:border-crimson-bright/50 hover:text-crimson-bright"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Compare Players
          </Link>
        }
      />

      <div className="relative max-w-lg">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
        <Input
          autoFocus
          placeholder="Search players — e.g. Babar, Shaheen, Rizwan…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 pl-11 text-base"
        />
      </div>

      <div className="mt-8">
        {!isActiveQuery && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong py-20 text-center">
            <Users className="h-8 w-8 text-fg-faint" />
            <p className="mt-3 text-sm text-fg-muted">Type at least 2 characters to search players.</p>
          </div>
        )}

        {isActiveQuery && isPending && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        )}

        {isActiveQuery && !isPending && searched && searchError && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-crimson-bright/30 bg-surface px-6 py-10 text-center">
            <p className="text-sm font-medium text-crimson-bright">Search failed</p>
            <p className="max-w-sm text-xs text-fg-faint">{searchError}</p>
          </div>
        )}

        {isActiveQuery && !isPending && searched && !searchError && results.length === 0 && (
          <p className="py-10 text-center text-sm text-fg-faint">No players found for &ldquo;{query}&rdquo;.</p>
        )}

        {isActiveQuery && !isPending && results.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {results.map((p) => (
              <Link key={p.player_id} href={`/players/${p.player_id}`}>
                <Card className="group flex h-full flex-col items-center gap-3 p-5 text-center transition-colors hover:border-crimson-bright/40">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 font-display text-lg font-semibold text-fg-muted group-hover:text-crimson-bright">
                    {(p.display_name ?? p.full_name).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ivory">{p.display_name ?? p.full_name}</p>
                    <p className="mt-0.5 text-xs text-fg-faint">
                      {p.primary_role ?? "—"}
                      {p.nationality ? ` · ${p.nationality}` : ""}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
