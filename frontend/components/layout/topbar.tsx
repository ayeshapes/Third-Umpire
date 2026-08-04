"use client";

import { Search, Bell } from "lucide-react";
import { openCommandPalette } from "@/components/shared/command-palette";

export function Topbar({ title = "Third Umpire" }: { title?: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-line bg-void/90 px-6 backdrop-blur-md shadow-[0_1px_2px_rgba(41,30,20,0.03)]">
      <h1 className="font-display text-lg font-semibold uppercase tracking-wide text-ivory">{title}</h1>

      <div className="flex flex-1 items-center justify-end gap-3">
        <button
          onClick={openCommandPalette}
          className="hidden w-full max-w-sm items-center gap-2.5 rounded-xl border border-line-strong bg-surface px-4 py-2 text-left text-sm text-fg-faint transition-colors hover:border-line-strong hover:text-fg-muted sm:flex"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1">Search players, teams, venues…</span>
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </button>
        <button
          onClick={openCommandPalette}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-fg-muted transition-colors hover:border-line-strong hover:text-ivory sm:hidden"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-fg-muted transition-colors hover:border-line-strong hover:text-ivory">
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
