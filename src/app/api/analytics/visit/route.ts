import { NextRequest, NextResponse } from "next/server";
import { recordVisit } from "@/lib/analytics/server";

export const runtime = "nodejs";
export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const result = await recordVisit(payload, request.headers);

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    disabled: result.disabled ?? false,
    limited: result.limited ?? false,
    deduped: result.deduped ?? false,
  });
}
