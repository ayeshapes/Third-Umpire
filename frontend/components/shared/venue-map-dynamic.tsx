"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const VenueMapDynamic = dynamic(() => import("./venue-map").then((m) => m.VenueMap), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full rounded-xl" />,
});
