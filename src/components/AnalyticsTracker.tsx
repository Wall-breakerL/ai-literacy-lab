"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordVisit } from "@/lib/analytics/client";
import { initAlibabaCloudObservability } from "@/lib/observability/browser";

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    initAlibabaCloudObservability();
  }, []);

  useEffect(() => {
    const query = window.location.search.replace(/^\?/, "");
    recordVisit(query ? `${pathname}?${query}` : pathname);
  }, [pathname]);

  return null;
}
