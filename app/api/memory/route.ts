import { NextRequest, NextResponse } from "next/server";
import { readJsonFile } from "@/lib/storage/file-json-storage";
import type { ExperienceCard } from "@/lib/memory/experience-card";
import type { UserMemoryCard } from "@/lib/memory/user-memory";

/** 研究用：读取用户记忆卡或单条 experience（本地 file-json）。 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const id = request.nextUrl.searchParams.get("id");
  if (!type || !id) {
    return NextResponse.json({ error: "type and id required" }, { status: 400 });
  }
  if (type === "user") {
    const card = await readJsonFile<UserMemoryCard>(`users/${id}.json`);
    if (!card) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(card);
  }
  if (type === "experience") {
    const card = await readJsonFile<ExperienceCard>(`experiences/${id}.json`);
    if (!card) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(card);
  }
  return NextResponse.json({ error: "invalid type" }, { status: 400 });
}
