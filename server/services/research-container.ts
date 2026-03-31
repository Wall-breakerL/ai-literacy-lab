import {
  InMemoryResearchAnnotationRepository,
  type ResearchAnnotationRepository,
} from "@/server/repositories/research-annotation-repository";

declare global {
  var __researchAnnotationRepositorySingleton: ResearchAnnotationRepository | undefined;
}

export function getResearchAnnotationRepository(): ResearchAnnotationRepository {
  if (!globalThis.__researchAnnotationRepositorySingleton) {
    globalThis.__researchAnnotationRepositorySingleton = new InMemoryResearchAnnotationRepository();
  }
  return globalThis.__researchAnnotationRepositorySingleton;
}

