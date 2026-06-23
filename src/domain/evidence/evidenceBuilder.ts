import type { DemoCoverageBand } from "../../demo/dataset";
import type { DemoRepo } from "../../repos/demoRepo";
import type { CoverageAssessment } from "../coverage/coverageCalculator";
import type {
  ConflictAssessment,
  ConflictItem,
} from "../conflicts/conflictDetector";
import type { FairnessAssessment } from "../fairness/fairnessAnalyzer";
import type { RiskReason } from "../scoring/riskScorer";

export type EvidenceSourceType =
  | "coverage_requirement"
  | "role_staffing"
  | "existing_absence"
  | "overlapping_request"
  | "critical_window"
  | "notice_period"
  | "fairness_history";

export type EvidenceItem = {
  id: string;
  requestId: string;
  sourceType: EvidenceSourceType;
  title: string;
  explanation: string;
  dateRange?: { start: string; end: string };
  teamId?: string;
  roleId?: string;
  relatedIds: Record<string, string>;
  severity: DemoCoverageBand;
};

export type EvidenceBundle = {
  items: EvidenceItem[];
  // For convenience when wiring reasons, store evidence ids per reason code.
  reasonEvidenceIds: Record<string, string[]>;
};

function safeEvidenceId(parts: string[]): string {
  const raw = ["ev", ...parts].join("_");
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function push(
  bundle: EvidenceBundle,
  reasonCode: string | null,
  item: EvidenceItem,
) {
  bundle.items.push(item);
  if (reasonCode) {
    bundle.reasonEvidenceIds[reasonCode] ??= [];
    bundle.reasonEvidenceIds[reasonCode].push(item.id);
  }
}

function conflictsOfKind<TKind extends ConflictItem["kind"]>(
  conflicts: ConflictAssessment,
  kind: TKind,
): Array<Extract<ConflictItem, { kind: TKind }>> {
  return conflicts.items.filter((c) => c.kind === kind) as Array<
    Extract<ConflictItem, { kind: TKind }>
  >;
}

type EvidenceBuildContext = {
  bundle: EvidenceBundle;
  requestId: string;
  teamId: string;
  roleId: string;
  teamName: string;
  roleName: string;
  band: DemoCoverageBand;
  coverage: CoverageAssessment;
};

function isCoverageReason(reason: RiskReason) {
  return (
    reason.code === "coverage_above_requirement" ||
    reason.code === "coverage_below_requirement" ||
    reason.code === "coverage_exact_requirement"
  );
}

function coverageRequirementExplanation(
  reason: RiskReason,
  coverage: CoverageAssessment,
) {
  if (reason.code === "coverage_above_requirement") {
    return `Minimum required is ${coverage.required}. Coverage stays above the minimum with available coverage as low as ${coverage.minAvailable} during the selected dates.`;
  }

  return `Minimum required is ${coverage.required}. With this request included, available coverage falls as low as ${coverage.minAvailable} during the selected dates.`;
}

function pushCoverageRequirementEvidence(
  context: EvidenceBuildContext,
  reason: RiskReason,
) {
  const {
    bundle,
    requestId,
    teamId,
    roleId,
    teamName,
    roleName,
    band,
    coverage,
  } = context;

  push(bundle, reason.code, {
    id: safeEvidenceId([
      requestId,
      "coverage_requirement",
      coverage.evidence.requirementId ?? "unknown",
    ]),
    requestId,
    sourceType: "coverage_requirement",
    title: `${teamName}: ${roleName} coverage requirement`,
    explanation: coverageRequirementExplanation(reason, coverage),
    dateRange: { start: coverage.range.start, end: coverage.range.end },
    teamId,
    roleId,
    relatedIds: {
      requirementId: coverage.evidence.requirementId ?? "unknown",
    },
    severity: band,
  });
}

function pushSinglePersonRoleEvidence(context: EvidenceBuildContext) {
  const {
    bundle,
    requestId,
    teamId,
    roleId,
    teamName,
    roleName,
    band,
    coverage,
  } = context;

  push(bundle, "single_person_role_exposure", {
    id: safeEvidenceId([requestId, "role_staffing", roleId]),
    requestId,
    sourceType: "role_staffing",
    title: `${teamName}: ${roleName} staffing depth`,
    explanation:
      "This demo dataset has single-person staffing for this role on this team. If the request is approved, there is no same-role backup for at least one day.",
    dateRange: { start: coverage.range.start, end: coverage.range.end },
    teamId,
    roleId,
    relatedIds: { roleId },
    severity: band,
  });
}

function pushReasonEvidence(context: EvidenceBuildContext, reason: RiskReason) {
  if (isCoverageReason(reason)) {
    pushCoverageRequirementEvidence(context, reason);
    return;
  }
  if (reason.code === "single_person_role_exposure") {
    pushSinglePersonRoleEvidence(context);
  }
}

function pushCriticalWindowEvidence(
  context: EvidenceBuildContext,
  conflicts: ConflictAssessment,
) {
  const { bundle, requestId, teamId, teamName, band } = context;

  for (const window of conflictsOfKind(conflicts, "critical_window")) {
    push(bundle, "critical_window_overlap", {
      id: safeEvidenceId([requestId, "critical_window", window.windowId]),
      requestId,
      sourceType: "critical_window",
      title: `${teamName}: ${window.title}`,
      explanation: window.description,
      dateRange: { start: window.startDate, end: window.endDate },
      teamId,
      relatedIds: { windowId: window.windowId },
      severity: band,
    });
  }
}

function pushExistingAbsenceEvidence(
  context: EvidenceBuildContext,
  conflicts: ConflictAssessment,
) {
  const { bundle, requestId, teamId, roleId, teamName, band } = context;

  for (const absence of conflictsOfKind(conflicts, "overlapping_absence")) {
    push(bundle, "overlapping_absence", {
      id: safeEvidenceId([requestId, "existing_absence", absence.absenceId]),
      requestId,
      sourceType: "existing_absence",
      title: `${teamName}: overlapping absence for ${absence.employeeDisplayName}`,
      explanation: absence.note,
      dateRange: { start: absence.startDate, end: absence.endDate },
      teamId,
      roleId,
      relatedIds: {
        absenceId: absence.absenceId,
        employeeId: absence.employeeId,
      },
      severity: band,
    });
  }
}

function pushOverlappingRequestEvidence(
  context: EvidenceBuildContext,
  conflicts: ConflictAssessment,
) {
  const { bundle, requestId, teamId, roleId, teamName, roleName, band } =
    context;

  for (const request of conflictsOfKind(conflicts, "overlapping_request")) {
    push(bundle, "overlapping_request", {
      id: safeEvidenceId([requestId, "overlapping_request", request.requestId]),
      requestId,
      sourceType: "overlapping_request",
      title: `${teamName}: overlapping request ${request.requestId}`,
      explanation: `Another ${roleName} request overlaps these dates. Status: ${request.status}.`,
      dateRange: { start: request.startDate, end: request.endDate },
      teamId,
      roleId,
      relatedIds: { requestId: request.requestId },
      severity: band,
    });
  }
}

function pushShortNoticeEvidence(
  context: EvidenceBuildContext,
  conflicts: ConflictAssessment,
) {
  const { bundle, requestId, teamId, roleId, band, coverage } = context;

  for (const notice of conflictsOfKind(conflicts, "short_notice")) {
    push(bundle, "short_notice", {
      id: safeEvidenceId([requestId, "notice_period", String(notice.leadDays)]),
      requestId,
      sourceType: "notice_period",
      title: "Notice period",
      explanation: `This request was submitted with ${notice.leadDays} day(s) lead time. Short notice can make handoffs harder to staff.`,
      dateRange: { start: coverage.range.start, end: coverage.range.end },
      teamId,
      roleId,
      relatedIds: { leadDays: String(notice.leadDays) },
      severity: band,
    });
  }
}

function pushConflictEvidence(
  context: EvidenceBuildContext,
  conflicts: ConflictAssessment,
) {
  pushCriticalWindowEvidence(context, conflicts);
  pushExistingAbsenceEvidence(context, conflicts);
  pushOverlappingRequestEvidence(context, conflicts);
  pushShortNoticeEvidence(context, conflicts);
}

function pushFairnessEvidence(
  context: EvidenceBuildContext,
  fairness: FairnessAssessment,
) {
  if (!fairness.evidence.fairnessHistoryId) return;

  const { bundle, requestId, teamId, roleId, band } = context;
  push(bundle, null, {
    id: safeEvidenceId([
      requestId,
      "fairness_history",
      fairness.evidence.fairnessHistoryId,
    ]),
    requestId,
    sourceType: "fairness_history",
    title: "Balance signals (context only)",
    explanation: fairness.note,
    teamId,
    roleId,
    relatedIds: { fairnessHistoryId: fairness.evidence.fairnessHistoryId },
    severity: band,
  });
}

function sortEvidenceBundle(bundle: EvidenceBundle) {
  bundle.items.sort((a, b) => (a.id === b.id ? 0 : a.id < b.id ? -1 : 1));
  for (const key of Object.keys(bundle.reasonEvidenceIds)) {
    bundle.reasonEvidenceIds[key].sort();
  }
}

export function buildEvidenceBundle(args: {
  repo: DemoRepo;
  requestId: string;
  teamId: string;
  roleId: string;
  band: DemoCoverageBand;
  coverage: CoverageAssessment;
  conflicts: ConflictAssessment;
  fairness: FairnessAssessment;
  reasons: RiskReason[];
}): EvidenceBundle {
  const {
    repo,
    requestId,
    teamId,
    roleId,
    band,
    coverage,
    conflicts,
    fairness,
    reasons,
  } = args;

  const bundle: EvidenceBundle = { items: [], reasonEvidenceIds: {} };

  const teamName = repo.teams.find((t) => t.id === teamId)?.name ?? teamId;
  const roleName = repo.roles.find((r) => r.id === roleId)?.name ?? roleId;
  const context: EvidenceBuildContext = {
    bundle,
    requestId,
    teamId,
    roleId,
    teamName,
    roleName,
    band,
    coverage,
  };

  for (const reason of reasons) {
    pushReasonEvidence(context, reason);
  }

  pushConflictEvidence(context, conflicts);
  pushFairnessEvidence(context, fairness);

  // Ensure deterministic order for stable output and fingerprints.
  sortEvidenceBundle(bundle);

  return bundle;
}
