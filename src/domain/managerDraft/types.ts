import type { DemoCoverageBand, DemoRecommendation } from "../../demo/dataset";

export const managerDraftActionValues = [
  "approve",
  "approve_with_coverage_actions",
  "defer",
  "ask_for_coverage",
] as const;

export type ManagerDraftAction = (typeof managerDraftActionValues)[number];

export type ManagerDraftSource = "mock" | "local";

export const managerDraftWarningValues = [
  "unsupported_provider",
  "local_provider_config_incomplete",
  "local_provider_url_rejected",
  "local_provider_failed",
  "local_provider_response_rejected",
] as const;

export type ManagerDraftWarning = (typeof managerDraftWarningValues)[number];

export type ManagerDraftResult = {
  demoMode: boolean;
  requestId: string;
  action: ManagerDraftAction;
  draft: string;
  context: {
    band: DemoCoverageBand;
    recommendation: DemoRecommendation;
  };
  meta: {
    source: ManagerDraftSource;
    simulationOnly: true;
    warnings: ManagerDraftWarning[];
  };
};
