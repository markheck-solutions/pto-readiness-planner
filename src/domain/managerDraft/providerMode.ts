import type { ManagerDraftWarning } from "./types";

export function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return fallback;
}

type LocalProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type ResolvedManagerDraftProvider =
  | {
      demoMode: boolean;
      source: "mock";
      warnings: ManagerDraftWarning[];
      localConfig: null;
    }
  | {
      demoMode: boolean;
      source: "local";
      warnings: ManagerDraftWarning[];
      localConfig: LocalProviderConfig;
    };

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1");
  if (normalized === "localhost" || normalized === "::1") return true;
  if (normalized === "127.0.0.1") return true;
  return /^127\.\d+\.\d+\.\d+$/.test(normalized);
}

export function isLocalBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return isLoopbackHostname(url.hostname);
  } catch {
    return false;
  }
}

export function resolveManagerDraftProvider(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedManagerDraftProvider {
  const demoMode = parseBooleanEnv(env.NEXT_PUBLIC_DEMO_MODE, true);
  const provider = (env.AI_PROVIDER ?? "mock").trim().toLowerCase();

  if (demoMode || provider === "" || provider === "mock") {
    return {
      demoMode,
      source: "mock",
      warnings: [],
      localConfig: null,
    };
  }

  if (provider !== "local") {
    return {
      demoMode,
      source: "mock",
      warnings: ["unsupported_provider"],
      localConfig: null,
    };
  }

  const baseUrl = env.OPENAI_COMPATIBLE_BASE_URL?.trim() ?? "";
  const apiKey = env.OPENAI_COMPATIBLE_API_KEY?.trim() ?? "";
  const model = env.OPENAI_COMPATIBLE_MODEL?.trim() ?? "";

  if (!baseUrl || !apiKey || !model) {
    return {
      demoMode,
      source: "mock",
      warnings: ["local_provider_config_incomplete"],
      localConfig: null,
    };
  }

  if (!isLocalBaseUrl(baseUrl)) {
    return {
      demoMode,
      source: "mock",
      warnings: ["local_provider_url_rejected"],
      localConfig: null,
    };
  }

  return {
    demoMode,
    source: "local",
    warnings: [],
    localConfig: {
      baseUrl,
      apiKey,
      model,
    },
  };
}
