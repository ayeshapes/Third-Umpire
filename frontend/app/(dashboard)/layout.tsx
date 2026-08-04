import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/shared/command-palette";
import { FilterProvider } from "@/store/filters";
import { AppProviders } from "@/app/providers";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      {/* FilterProvider reads useSearchParams() (via FilterUrlSync) for
          Ticket 6.5's URL sync -- Next.js requires that to sit inside a
          Suspense boundary so the rest of the layout can still render
          without opting the whole route into client-only rendering. */}
      <Suspense fallback={null}>
        <FilterProvider>
          <div className="flex min-h-screen bg-void">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main className="flex-1 px-6 py-8 md:px-8">{children}</main>
            </div>
            <CommandPalette />
          </div>
        </FilterProvider>
      </Suspense>
    </AppProviders>
  );
}
