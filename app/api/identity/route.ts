import { NextRequest, NextResponse } from "next/server";
import { compileIdentityDossier } from "@/lib/identity/compiler";
import type { IdentityDossier, IdentitySource, IdentityStructuredSummary } from "@/lib/identity/types";
import { readJsonFile, writeJsonFile } from "@/lib/storage/file-json-storage";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const dossier = await readJsonFile<IdentityDossier>(pathForIdentity(id));
  if (!dossier) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(dossier);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      source: IdentitySource;
      rawPrompt?: string;
      structuredSummary?: Partial<IdentityStructuredSummary>;
    };
    if (!body.source) {
      return NextResponse.json({ error: "source required" }, { status: 400 });
    }
    const dossier = await compileIdentityDossier({
      source: body.source,
      rawPrompt: body.rawPrompt ?? "",
      structuredSummary: body.structuredSummary,
    });
    await writeJsonFile(pathForIdentity(dossier.identityId), dossier);
    return NextResponse.json(dossier);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function pathForIdentity(id: string): string {
  return `identities/${id}.json`;
}
