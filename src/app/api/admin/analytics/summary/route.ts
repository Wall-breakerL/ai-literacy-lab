import { NextRequest, NextResponse } from "next/server";
import {
  isAuthorizedAnalyticsAdmin,
  readAdminAnalyticsSummary,
} from "@/lib/analytics/server";

export const runtime = "nodejs";
export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedAnalyticsAdmin(request.headers)) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const summary = await readAdminAnalyticsSummary({
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
  });
  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "private, max-age=30",
    },
  });
}
