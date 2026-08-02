import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PublicNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-void/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-crimson font-display text-sm font-bold text-ivory">
            TU
          </span>
          <span className="font-display text-base font-semibold uppercase tracking-wide">Third Umpire</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-fg-muted md:flex">
          <Link href="/dashboard" className="transition-colors hover:text-ivory">Overview</Link>
          <Link href="/players" className="transition-colors hover:text-ivory">Players</Link>
          <Link href="/teams" className="transition-colors hover:text-ivory">Teams</Link>
          <Link href="/records" className="transition-colors hover:text-ivory">Records</Link>
          <Link href="/analytics" className="transition-colors hover:text-ivory">Analytics</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/players">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">View Players</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="primary" size="sm">Explore Analytics</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
