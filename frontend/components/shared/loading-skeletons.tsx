import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** One skeleton KPI tile, matching StatCard's exact proportions. */
export function StatCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-9 w-20" />
    </Card>
  );
}

/** A row of KPI skeletons -- drop-in placeholder for a StatCard grid. */
export function StatGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Placeholder for a chart or stat card with a header + body. */
export function ChartCardSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-3 w-32" />
      </CardHeader>
      <CardContent>
        <div className="flex h-56 items-end gap-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1"
              style={{ height: `${30 + ((i * 37) % 60)}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Placeholder for a leaderboard / stat table. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Full-page loading skeleton, used by app/(dashboard)/loading.tsx so every
 * page in the dashboard shell shows the same shape while it streams in. */
export function PageSkeleton() {
  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-8 w-64" />
          <Skeleton className="mt-2 h-3 w-80" />
        </div>
      </div>
      <StatGridSkeleton />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCardSkeleton />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-3 w-28" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={4} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
