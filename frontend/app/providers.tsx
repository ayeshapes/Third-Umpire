"use client";

/**
 * App-wide providers. Currently just React Query -- the filter bar's
 * dynamic dropdowns (hooks/use-filter-options.ts) need a
 * QueryClientProvider somewhere above them in the tree.
 *
 * `useState(() => new QueryClient())` (not a module-level singleton)
 * so each request/browser session gets its own client -- avoids
 * leaking cached data across users on the server and across
 * client-side navigations during dev/fast-refresh.
 */

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
