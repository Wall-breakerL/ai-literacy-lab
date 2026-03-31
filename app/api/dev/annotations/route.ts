import { AnnotationQuerySchema, AnnotationUpsertRequestSchema } from "@/domain/research/annotation";
import { handleApiError } from "@/lib/http";
import { getResearchAnnotationRepository } from "@/server/services/research-container";

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const query = AnnotationQuerySchema.parse({
      sessionId: searchParams.get("sessionId") ?? undefined,
      turnEventId: searchParams.get("turnEventId") ?? undefined,
    });
    return Response.json({ annotations: getResearchAnnotationRepository().list(query) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const input = AnnotationUpsertRequestSchema.parse(await request.json());
    const annotation = getResearchAnnotationRepository().upsert(input);
    return Response.json({ annotation });
  } catch (error) {
    return handleApiError(error);
  }
}

