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

function mockProvider(
  demoMode: boolean,
  warnings: ManagerDraftWarning[] = [],
): ResolvedManagerDraftProvider {
  return {
    demoMode,
    source: "mock",
    warnings,
    localConfig: null,
  };
}

function localProvider(
  demoMode: boolean,
  localConfig: LocalProviderConfig,
): ResolvedManagerDraftProvider {
  return {
    demoMode,
    source: "local",
    warnings: [],
    localConfig,
  };
}

function providerUsesMockFallback(provider: string) {
  return provider === "" || provider === "mock";
}

function readLocalProviderConfig(env: NodeJS.ProcessEnv): LocalProviderConfig {
  return {
    baseUrl: env.OPENAI_COMPATIBLE_BASE_URL?.trim() ?? "",
    apiKey: env.OPENAI_COMPATIBLE_API_KEY?.trim() ?? "",
    model: env.OPENAI_COMPATIBLE_MODEL?.trim() ?? "",
  };
}

function localProviderWarning(
  config: LocalProviderConfig,
): ManagerDraftWarning | null {
  if (!config.baseUrl || !config.apiKey || !config.model) {
    return "local_provider_config_incomplete";
  }
  if (!isLocalBaseUrl(config.baseUrl)) return "local_provider_url_rejected";
  return null;
}

export function resolveManagerDraftProvider(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedManagerDraftProvider {
  const demoMode = parseBooleanEnv(env.NEXT_PUBLIC_DEMO_MODE, true);
  const provider = (env.AI_PROVIDER ?? "mock").trim().toLowerCase();

  if (demoMode || providerUsesMockFallback(provider))
    return mockProvider(demoMode);

  if (provider !== "local") {
    return mockProvider(demoMode, ["unsupported_provider"]);
  }

  const localConfig = readLocalProviderConfig(env);
  const warning = localProviderWarning(localConfig);
  if (warning) return mockProvider(demoMode, [warning]);

  return localProvider(demoMode, localConfig);
}
