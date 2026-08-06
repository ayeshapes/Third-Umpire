import Link from "next/link";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/players", label: "Players" },
  { href: "/teams", label: "Teams" },
  { href: "/records", label: "Records" },
  { href: "/analytics", label: "Analytics" },
];

/**
 * Desktop-only header for the public homepage. Below md, the homepage
 * renders <Topbar> + <Sidebar showDesktopRail={false}> instead (see
 * app/page.tsx) -- that's the exact same hamburger-drawer combo every
 * other page already uses, rather than a second, separately-maintained
 * mobile menu here that can drift out of sync with it visually.
 */
export function PublicNavbar() {
  return (
    <header className="sticky top-0 z-50 hidden border-b border-line bg-void/80 backdrop-blur-md md:block">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-crimson font-display text-sm font-bold text-on-crimson">
            TU
          </span>
          <span className="font-display text-base font-semibold uppercase tracking-wide">Third Umpire</span>
        </Link>

        <nav className="flex items-center gap-7 text-sm text-fg-muted">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-ivory">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/players">
            <Button variant="ghost" size="sm">View Players</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="primary" size="sm">Explore Analytics</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
