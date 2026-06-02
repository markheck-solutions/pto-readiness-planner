import type {
  DemoCoverageBand,
  DemoPtoRequest,
  DemoRecommendation,
} from "../../demo/dataset";
import { parseIsoDate, type IsoDate } from "../dates";
import { createAssessmentForRequest } from "../assessment/createRequestAssessment";
import {
  findEmployeeById,
  findPtoRequestById,
  findRoleById,
  findTeamById,
  getDemoRepo,
  type DemoRepo,
} from "../../repos/demoRepo";

import { resolveManagerDraftProvider } from "./providerMode";
import { requestLocalManagerDraft } from "./localProvider";
import {
  managerDraftWarningValues,
  type ManagerDraftAction,
  type ManagerDraftResult,
  type ManagerDraftWarning,
} from "./types";

type ManagerDraftContext = {
  request: DemoPtoRequest;
  employeeName: string;
  teamName: string;
  roleName: string;
  requestedRange: {
    start: IsoDate;
    end: IsoDate;
  };
  coverage: {
    required: number;
    minAvailable: number;
    band: DemoCoverageBand;
    recommendation: DemoRecommendation;
  };
  topReason: string;
  firstConflict: string | null;
  availableBackups: string[];
};

function formatShortDay(iso: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(iso));
}

function formatDateRange(start: IsoDate, end: IsoDate): string {
  if (start === end) return formatShortDay(start);
  return `${formatShortDay(start)} to ${formatShortDay(end)}`;
}

function overlaps(
  a: { start: IsoDate; end: IsoDate },
  b: { start: IsoDate; end: IsoDate },
): boolean {
  return !(a.end < b.start || b.end < a.start);
}

function employeeAvailableForRange(
  repo: DemoRepo,
  employeeId: string,
  range: { start: IsoDate; end: IsoDate },
): boolean {
  for (const absence of repo.existingAbsences) {
    if (absence.employeeId !== employeeId) continue;
    if (overlaps(range, { start: absence.startDate, end: absence.endDate })) {
      return false;
    }
  }

  for (const request of repo.ptoRequests) {
    if (request.employeeId !== employeeId) continue;
    if (request.status === "withdrawn") continue;
    if (
      overlaps(range, {
        start: request.requestedStartDate,
        end: request.requestedEndDate,
      })
    ) {
      return false;
    }
  }

  return true;
}

function summarizeConflict(
  conflict: ReturnType<
    typeof createAssessmentForRequest
  >["conflicts"]["items"][number],
): string {
  if (conflict.kind === "critical_window") return conflict.title;
  if (conflict.kind === "overlapping_absence")
    return `${conflict.employeeDisplayName} already has overlapping time off`;
  if (conflict.kind === "overlapping_request")
    return `${conflict.employeeDisplayName} has another overlapping request`;
  return `${conflict.leadDays} day notice window`;
}

function buildContext(
  repo: DemoRepo,
  requestId: string,
): ManagerDraftContext | null {
  const request = findPtoRequestById(repo, requestId);
  if (!request) return null;

  const employee = findEmployeeById(repo, request.employeeId);
  if (!employee) return null;

  const team = findTeamById(repo, employee.teamId);
  const role = findRoleById(repo, employee.roleId);
  if (!team || !role) return null;

  const assessment = createAssessmentForRequest({
    repo,
    request,
    teamId: employee.teamId,
    roleId: employee.roleId,
  });

  const requestedRange = {
    start: request.requestedStartDate,
    end: request.requestedEndDate,
  };

  const availableBackups = repo.employees
    .filter((candidate) => candidate.teamId === team.id)
    .filter((candidate) => candidate.roleId === role.id)
    .filter((candidate) => candidate.id !== employee.id)
    .filter((candidate) =>
      employeeAvailableForRange(repo, candidate.id, requestedRange),
    )
    .map((candidate) => candidate.displayName)
    .sort((a, b) => a.localeCompare(b));

  return {
    request,
    employeeName: employee.displayName,
    teamName: team.name,
    roleName: role.name,
    requestedRange,
    coverage: {
      required: assessment.coverage.required,
      minAvailable: assessment.coverage.minAvailable,
      band: assessment.band,
      recommendation: assessment.recommendation,
    },
    topReason:
      assessment.reasons[0]?.summary ??
      "Coverage stays stable for the selected request window.",
    firstConflict: assessment.conflicts.items[0]
      ? summarizeConflict(assessment.conflicts.items[0])
      : null,
    availableBackups,
  };
}

function buildMockDraft(
  context: ManagerDraftContext,
  action: ManagerDraftAction,
): string {
  const rangeLabel = formatDateRange(
    context.requestedRange.start,
    context.requestedRange.end,
  );
  const coverageLine =
    context.coverage.minAvailable > context.coverage.required
      ? `${context.roleName} coverage stays above the ${context.coverage.required}-person minimum for ${context.teamName}.`
      : `${context.roleName} coverage stays at the ${context.coverage.required}-person minimum for ${context.teamName}.`;
  const backupLine =
    context.availableBackups.length > 0
      ? `Please line up ${context.availableBackups.join(", ")} as the backup for the handoff before the window starts.`
      : `Please confirm the handoff plan because no ready same-role backup is visible in the current demo window.`;

  if (action === "approve_with_coverage_actions") {
    return `Hi ${context.employeeName}, I can approve your ${context.request.requestType.toUpperCase()} request for ${rangeLabel}. ${coverageLine} ${backupLine}`;
  }

  if (action === "approve") {
    if (context.coverage.recommendation === "approve_with_coverage_actions") {
      return `Hi ${context.employeeName}, I can approve your ${context.request.requestType.toUpperCase()} request for ${rangeLabel}. ${coverageLine} ${backupLine}`;
    }

    return `Hi ${context.employeeName}, your ${context.request.requestType.toUpperCase()} request for ${rangeLabel} is approved. ${coverageLine} Please post the usual ${context.roleName.toLowerCase()} handoff notes before the time away starts.`;
  }

  if (action === "ask_for_coverage") {
    return `Hi ${context.employeeName}, before I finalize ${rangeLabel}, please confirm who will cover ${context.roleName} work for ${context.teamName} and when the handoff notes will be ready. ${backupLine} I only need the coverage details for this window.`;
  }

  return `Hi ${context.employeeName}, I need to defer your ${context.request.requestType.toUpperCase()} request for ${rangeLabel} for now. ${context.firstConflict ?? context.topReason} is the main blocker, and I do not want to create a coverage gap for ${context.teamName}. Let us revisit dates or a stronger coverage plan once that risk is cleared.`;
}

function isManagerDraftWarning(value: unknown): value is ManagerDraftWarning {
  return (
    typeof value === "string" &&
    (managerDraftWarningValues as readonly string[]).includes(value)
  );
}

export async function generateManagerDraft(args: {
  requestId: string;
  action: ManagerDraftAction;
  env?: NodeJS.ProcessEnv;
  repo?: DemoRepo;
}): Promise<ManagerDraftResult | null> {
  const repo = args.repo ?? getDemoRepo();
  const context = buildContext(repo, args.requestId);
  if (!context) return null;

  const resolvedProvider = resolveManagerDraftProvider(args.env);
  const fallbackDraft = buildMockDraft(context, args.action);
  const requestedRangeLabel = formatDateRange(
    context.requestedRange.start,
    context.requestedRange.end,
  );

  let source: ManagerDraftResult["meta"]["source"] = resolvedProvider.source;
  let warnings = [...resolvedProvider.warnings];
  let draft = fallbackDraft;

  if (resolvedProvider.source === "local" && resolvedProvider.localConfig) {
    try {
      draft = await requestLocalManagerDraft({
        config: resolvedProvider.localConfig,
        input: {
          action: args.action,
          employeeName: context.employeeName,
          teamName: context.teamName,
          roleName: context.roleName,
          requestedRangeLabel,
          band: context.coverage.band,
          recommendation: context.coverage.recommendation,
          topReason: context.topReason,
          firstConflict: context.firstConflict,
          availableBackups: context.availableBackups,
        },
      });
    } catch (error) {
      source = "mock";
      warnings = [
        ...warnings,
        error &&
        typeof error === "object" &&
        "warning" in error &&
        isManagerDraftWarning(error.warning)
          ? error.warning
          : "local_provider_failed",
      ];
      draft = fallbackDraft;
    }
  }

  return {
    demoMode: resolvedProvider.demoMode,
    requestId: context.request.id,
    action: args.action,
    draft,
    context: {
      band: context.coverage.band,
      recommendation: context.coverage.recommendation,
    },
    meta: {
      source,
      simulationOnly: true,
      warnings,
    },
  };
}
