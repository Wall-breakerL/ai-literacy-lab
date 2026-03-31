import { EngineService } from "@/server/engine/engine-service";

declare global {
  var __engineServiceSingleton: EngineService | undefined;
}

export function getSessionService(): EngineService {
  if (!globalThis.__engineServiceSingleton) {
    globalThis.__engineServiceSingleton = new EngineService();
  }
  return globalThis.__engineServiceSingleton;
}
