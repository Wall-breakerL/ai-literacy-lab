import type { IBrowserConfig } from "@arms/rum-browser/lib/types/client";

type ObservabilityEvent = {
  type: "visit" | "test_result";
  path: string;
  sessionId?: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

type SlsTracker = {
  send: (payload: Record<string, unknown>) => void;
  sendImmediate?: (payload: Record<string, unknown>) => void;
  useStsPlugin?: (plugin: unknown) => void;
};

let initialized = false;
let slsTracker: SlsTracker | null = null;

export function initAlibabaCloudObservability() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  void initArmsRum();
  void initSlsWebTracking();
}

export function trackObservabilityEvent(payload: ObservabilityEvent) {
  if (typeof window === "undefined" || !slsTracker) return;
  slsTracker.send({
    type: payload.type,
    path: payload.path.split("?")[0],
    session_id: payload.sessionId ?? "",
    occurred_at: payload.occurredAt,
    metadata: JSON.stringify(payload.metadata ?? {}),
  });
}

async function initArmsRum() {
  const pid = process.env.NEXT_PUBLIC_ARMS_RUM_PID;
  const endpoint = process.env.NEXT_PUBLIC_ARMS_RUM_ENDPOINT;
  if (!pid || !endpoint) return;

  try {
    const { default: armsRum } = await import("@arms/rum-browser");
    await armsRum.init({
      pid,
      endpoint,
      env: normalizeArmsEnv(process.env.NEXT_PUBLIC_ARMS_RUM_ENV || process.env.NODE_ENV),
      version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
      spaMode: "history",
      replay: process.env.NEXT_PUBLIC_ARMS_RUM_REPLAY === "1"
        ? { enable: true, sampling: Number(process.env.NEXT_PUBLIC_ARMS_RUM_REPLAY_SAMPLING ?? 5), privacy: { level: "mask" } }
        : false,
      sessionConfig: {
        storage: "localStorage",
      },
    } satisfies IBrowserConfig);
  } catch (error) {
    if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1") {
      console.warn("[observability] ARMS RUM init failed", error);
    }
  }
}

function normalizeArmsEnv(value: string): IBrowserConfig["env"] {
  return ARMS_ENV_VALUES.has(value) ? value as IBrowserConfig["env"] : "prod";
}

async function initSlsWebTracking() {
  const host = process.env.NEXT_PUBLIC_SLS_WEBTRACK_HOST;
  const project = process.env.NEXT_PUBLIC_SLS_WEBTRACK_PROJECT;
  const logstore = process.env.NEXT_PUBLIC_SLS_WEBTRACK_LOGSTORE;
  const stsEndpoint = process.env.NEXT_PUBLIC_SLS_WEBTRACK_STS_ENDPOINT;
  const allowAnonymous = process.env.NEXT_PUBLIC_SLS_WEBTRACK_ALLOW_ANONYMOUS === "1";
  if (!host || !project || !logstore || (!stsEndpoint && !allowAnonymous)) return;

  try {
    const [{ default: SlsTracker }, { default: createStsPlugin }] = await Promise.all([
      import("@aliyun-sls/web-track-browser"),
      import("@aliyun-sls/web-sts-plugin"),
    ]);
    const tracker = new SlsTracker({
      host,
      project,
      logstore,
      time: Number(process.env.NEXT_PUBLIC_SLS_WEBTRACK_FLUSH_SECONDS ?? 10),
      count: Number(process.env.NEXT_PUBLIC_SLS_WEBTRACK_FLUSH_COUNT ?? 10),
      topic: process.env.NEXT_PUBLIC_SLS_WEBTRACK_TOPIC || "ai-mbti",
      source: process.env.NEXT_PUBLIC_SLS_WEBTRACK_SOURCE || "browser",
      tags: {
        app: "human-ai-performance-lab",
        env: process.env.NEXT_PUBLIC_ARMS_RUM_ENV || process.env.NODE_ENV,
      },
    }) as SlsTracker;

    if (stsEndpoint) {
      const stsOptions: {
        accessKeyId: string;
        accessKeySecret: string;
        securityToken: string;
        stsTokenFreshTime: number;
        refreshSTSTokenInterval: number;
        refreshSTSToken: () => Promise<void>;
      } = {
        accessKeyId: "",
        accessKeySecret: "",
        securityToken: "",
        stsTokenFreshTime: 0,
        refreshSTSTokenInterval: Number(process.env.NEXT_PUBLIC_SLS_WEBTRACK_STS_REFRESH_MS ?? 300_000),
        refreshSTSToken: async () => {
          const response = await fetch(stsEndpoint, { credentials: "same-origin", cache: "no-store" });
          if (!response.ok) throw new Error(`STS refresh failed: ${response.status}`);
          const data = await response.json() as {
            accessKeyId?: string;
            accessKeySecret?: string;
            securityToken?: string;
          };
          if (!data.accessKeyId || !data.accessKeySecret || !data.securityToken) {
            throw new Error("STS refresh response is incomplete");
          }
          stsOptions.accessKeyId = data.accessKeyId;
          stsOptions.accessKeySecret = data.accessKeySecret;
          stsOptions.securityToken = data.securityToken;
        },
      };
      tracker.useStsPlugin?.(createStsPlugin(stsOptions));
    }

    slsTracker = tracker;
  } catch (error) {
    if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1") {
      console.warn("[observability] SLS WebTracking init failed", error);
    }
  }
}
const ARMS_ENV_VALUES = new Set(["prod", "gray", "pre", "daily", "local"]);
