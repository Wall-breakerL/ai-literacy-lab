import {
  AnnotationQuerySchema,
  AnnotationUpsertRequestSchema,
  TurnAnnotationSchema,
  type AnnotationQuery,
  type AnnotationUpsertRequest,
  type TurnAnnotation,
} from "@/domain/research/annotation";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";

export interface ResearchAnnotationRepository {
  upsert(input: AnnotationUpsertRequest): TurnAnnotation;
  list(query?: AnnotationQuery): TurnAnnotation[];
}

export class InMemoryResearchAnnotationRepository implements ResearchAnnotationRepository {
  private readonly items = new Map<string, TurnAnnotation>();

  upsert(input: AnnotationUpsertRequest): TurnAnnotation {
    const parsed = AnnotationUpsertRequestSchema.parse(input);
    const key = `${parsed.sessionId}:${parsed.turnEventId}`;
    const current = this.items.get(key);
    const next = TurnAnnotationSchema.parse({
      id: current?.id ?? createId("anno"),
      sessionId: parsed.sessionId,
      turnEventId: parsed.turnEventId,
      sceneId: parsed.sceneId,
      tagger: parsed.tagger,
      labels: parsed.labels,
      note: parsed.note,
      updatedAt: nowIso(),
    });
    this.items.set(key, next);
    return next;
  }

  list(query?: AnnotationQuery): TurnAnnotation[] {
    const parsed = AnnotationQuerySchema.parse(query ?? {});
    let values = [...this.items.values()];
    if (parsed.sessionId) {
      values = values.filter((item) => item.sessionId === parsed.sessionId);
    }
    if (parsed.turnEventId) {
      values = values.filter((item) => item.turnEventId === parsed.turnEventId);
    }
    return values.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }
}

