import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    /** Deterministic engine tests: force rule-based Agent B fallback (no live LLM). */
    env: {
      OPENAI_API_KEY: "",
      LLM_ENABLED: "false",
    },
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
