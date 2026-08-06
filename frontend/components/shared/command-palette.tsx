"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, Users, Shield, MapPin, LayoutDashboard, Trophy, Handshake } from "lucide-react";
import { api } from "@/lib/api";
import { effectiveRoleLabel } from "@/lib/player-role";
import type { PlayerSearchResult, Team, TeamSearchResult, Venue, VenueSearchResult } from "@/types/api";

const STATIC_LINKS = [
  { label: "Overview Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Records", href: "/records", icon: Trophy },
  { label: "Head-to-Head", href: "/head-to-head", icon: Handshake },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<PlayerSearchResult[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [searchedTeams, setSearchedTeams] = useState<TeamSearchResult[]>([]);
  const [searchedVenues, setSearchedVenues] = useState<VenueSearchResult[]>([]);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("open-command-palette", onOpenRequest);
    return () => window.removeEventListener("open-command-palette", onOpenRequest);
  }, []);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.teams().catch(() => []),
      api.venues().catch(() => []),
    ]).then(([t, v]) => {
      setTeams(t);
      setVenues(v);
    });
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchedTeams([]);
      setSearchedVenues([]);
      return;
    }
    const handle = setTimeout(() => {
      const q = query.trim();
      api.playersSearch(q).then(setPlayers).catch(() => setPlayers([]));
      // Fuzzy, typo-tolerant search (pg_trgm), same as players -- replaces
      // the plain substring filter over the full teams/venues lists below
      // once there's an actual query to search for.
      api.teamsSearch(q).then(setSearchedTeams).catch(() => setSearchedTeams([]));
      api.venuesSearch(q).then(setSearchedVenues).catch(() => setSearchedVenues([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  const q = query.trim().toLowerCase();
  // Below 2 characters there's nothing to fuzzy-match against yet, so
  // this just shows a handful of teams/venues as quick-glance defaults
  // (same as before); at 2+ characters, searchedTeams/searchedVenues
  // come from the pg_trgm-backed /api/teams/search and
  // /api/venues/search endpoints, same typo-tolerant search players get.
  const filteredTeams = q.length >= 2 ? searchedTeams : teams.slice(0, 4);
  const filteredVenues = q.length >= 2 ? searchedVenues : venues.slice(0, 4);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-void/70 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <Command
        shouldFilter={false}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-fg-faint" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search players, teams, venues…"
            className="h-12 flex-1 bg-transparent text-sm text-ivory placeholder:text-fg-faint focus:outline-none"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-fg-faint">ESC</kbd>
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-fg-faint">No results found.</Command.Empty>

          {!q && (
            <Command.Group heading="Quick Links" className="px-2 py-1 text-[11px] uppercase tracking-widest text-fg-faint">
              {STATIC_LINKS.map((l) => (
                <Command.Item
                  key={l.href}
                  onSelect={() => go(l.href)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-ivory data-[selected=true]:bg-crimson/15"
                >
                  <l.icon className="h-4 w-4 text-crimson-bright" />
                  {l.label}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {q.length >= 2 && players.length > 0 && (
            <Command.Group heading="Players" className="px-2 py-1 text-[11px] uppercase tracking-widest text-fg-faint">
              {players.map((p) => (
                <Command.Item
                  key={`player-${p.player_id}`}
                  onSelect={() => go(`/players/${p.player_id}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-ivory data-[selected=true]:bg-crimson/15"
                >
                  <Users className="h-4 w-4 text-crimson-bright" />
                  {p.display_name ?? p.full_name}
                  {p.primary_role && <span className="ml-auto text-xs text-fg-faint">{effectiveRoleLabel(p.primary_role, p.avg_overs_per_match)}</span>}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {filteredTeams.length > 0 && (
            <Command.Group heading="Teams" className="px-2 py-1 text-[11px] uppercase tracking-widest text-fg-faint">
              {filteredTeams.map((t) => (
                <Command.Item
                  key={`team-${t.team_id}`}
                  onSelect={() => go(`/teams/${t.team_id}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-ivory data-[selected=true]:bg-crimson/15"
                >
                  <Shield className="h-4 w-4 text-crimson-bright" />
                  {t.team_name}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {filteredVenues.length > 0 && (
            <Command.Group heading="Venues" className="px-2 py-1 text-[11px] uppercase tracking-widest text-fg-faint">
              {filteredVenues.map((v) => (
                <Command.Item
                  key={`venue-${v.venue_id}`}
                  onSelect={() => go(`/venues/${v.venue_id}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-ivory data-[selected=true]:bg-crimson/15"
                >
                  <MapPin className="h-4 w-4 text-crimson-bright" />
                  {v.venue_name}
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
}

/** Call from anywhere (e.g. the topbar search box) to open the palette imperatively. */
export function openCommandPalette() {
  window.dispatchEvent(new Event("open-command-palette"));
}
