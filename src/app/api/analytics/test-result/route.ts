import { NextRequest, NextResponse } from "next/server";
import { recordTestResult } from "@/lib/analytics/server";

export const runtime = "nodejs";
export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const result = await recordTestResult(payload);

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    disabled: result.disabled ?? false,
  });
}
