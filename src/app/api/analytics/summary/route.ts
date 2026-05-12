import { NextResponse } from "next/server";
import { buildPublicAnalyticsSummary } from "@/lib/analytics/shared";
import { readPublicAnalyticsSummary } from "@/lib/analytics/server";

export const runtime = "nodejs";
export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await readPublicAnalyticsSummary();
    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[analytics] summary read failed", error);
    return NextResponse.json(
      buildPublicAnalyticsSummary({}, new Date().toISOString()),
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
