import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/shared/command-palette";
import { FilterProvider } from "@/store/filters";
import { AppProviders } from "@/app/providers";
import { DebugBoundary } from "@/components/dev/debug-boundary";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <Suspense fallback={null}>
        <FilterProvider>
          <div className="flex min-h-screen bg-void">
            <DebugBoundary name="Sidebar"><Sidebar /></DebugBoundary>
            <div className="flex min-w-0 flex-1 flex-col">
              <DebugBoundary name="Topbar"><Topbar /></DebugBoundary>
              <main className="flex-1 px-6 py-8 md:px-8">
                <DebugBoundary name="PageContent">{children}</DebugBoundary>
              </main>
            </div>
            <DebugBoundary name="CommandPalette"><CommandPalette /></DebugBoundary>
          </div>
        </FilterProvider>
      </Suspense>
    </AppProviders>
  );
}