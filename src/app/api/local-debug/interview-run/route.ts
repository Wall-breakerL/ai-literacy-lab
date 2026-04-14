import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type FinalizePayload = {
  sessionId: string;
  identity: string;
  startedAt?: string;
  finishedAt: string;
  transcript: unknown[];
};

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_available_in_production" }, { status: 404 });
  }

  try {
    const payload = await req.json() as FinalizePayload;
    if (!payload?.sessionId || !payload?.identity || !payload?.finishedAt || !Array.isArray(payload?.transcript)) {
      return NextResponse.json({ error: "bad_request", detail: "缺少 sessionId/identity/finishedAt/transcript" }, { status: 400 });
    }
    const dir = path.join(process.cwd(), ".local-debug", "interview-runs");
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${payload.sessionId}.json`);

    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
    } catch {
      existing = {};
    }

    await writeFile(
      filePath,
      `${JSON.stringify(
        {
          ...existing,
          savedAt: new Date().toISOString(),
          ...payload,
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    return NextResponse.json({
      ok: true,
      file: path.join(".local-debug", "interview-runs", `${payload.sessionId}.json`),
    });
  } catch (error) {
    console.error("local debug save failed:", error);
    return NextResponse.json({ error: "local_debug_save_failed" }, { status: 500 });
  }
}
