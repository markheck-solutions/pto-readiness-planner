import type { DemoCoverageBand } from "../../demo/dataset";
import type { DemoRepo } from "../../repos/demoRepo";
import type { CoverageAssessment } from "../coverage/coverageCalculator";
import type { ConflictAssessment, ConflictItem } from "../conflicts/conflictDetector";
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
  const { repo, requestId, teamId, roleId, band, coverage, conflicts, fairness, reasons } =
    args;

  const bundle: EvidenceBundle = { items: [], reasonEvidenceIds: {} };

  const teamName = repo.teams.find((t) => t.id === teamId)?.name ?? teamId;
  const roleName = repo.roles.find((r) => r.id === roleId)?.name ?? roleId;

  for (const reason of reasons) {
    if (
      reason.code === "coverage_below_requirement" ||
      reason.code === "coverage_exact_requirement"
    ) {
      push(bundle, reason.code, {
        id: safeEvidenceId([requestId, "coverage_requirement", coverage.evidence.requirementId ?? "unknown"]),
        requestId,
        sourceType: "coverage_requirement",
        title: `${teamName}: ${roleName} coverage requirement`,
        explanation: `Minimum required is ${coverage.required}. With this request included, available coverage falls as low as ${coverage.minAvailable} during the selected dates.`,
        dateRange: { start: coverage.range.start, end: coverage.range.end },
        teamId,
        roleId,
        relatedIds: {
          requirementId: coverage.evidence.requirementId ?? "unknown",
        },
        severity: band,
      });
    }

    if (reason.code === "single_person_role_exposure") {
      push(bundle, reason.code, {
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
  }

  for (const w of conflictsOfKind(conflicts, "critical_window")) {
    push(bundle, "critical_window_overlap", {
      id: safeEvidenceId([requestId, "critical_window", w.windowId]),
      requestId,
      sourceType: "critical_window",
      title: `${teamName}: ${w.title}`,
      explanation: w.description,
      dateRange: { start: w.startDate, end: w.endDate },
      teamId,
      relatedIds: { windowId: w.windowId },
      severity: band,
    });
  }

  for (const a of conflictsOfKind(conflicts, "overlapping_absence")) {
    push(bundle, "overlapping_absence", {
      id: safeEvidenceId([requestId, "existing_absence", a.absenceId]),
      requestId,
      sourceType: "existing_absence",
      title: `${teamName}: overlapping absence for ${a.employeeDisplayName}`,
      explanation: a.note,
      dateRange: { start: a.startDate, end: a.endDate },
      teamId,
      roleId,
      relatedIds: { absenceId: a.absenceId, employeeId: a.employeeId },
      severity: band,
    });
  }

  for (const r of conflictsOfKind(conflicts, "overlapping_request")) {
    push(bundle, "overlapping_request", {
      id: safeEvidenceId([requestId, "overlapping_request", r.requestId]),
      requestId,
      sourceType: "overlapping_request",
      title: `${teamName}: overlapping request ${r.requestId}`,
      explanation: `Another ${roleName} request overlaps these dates. Status: ${r.status}.`,
      dateRange: { start: r.startDate, end: r.endDate },
      teamId,
      roleId,
      relatedIds: { requestId: r.requestId },
      severity: band,
    });
  }

  for (const s of conflictsOfKind(conflicts, "short_notice")) {
    push(bundle, "short_notice", {
      id: safeEvidenceId([requestId, "notice_period", String(s.leadDays)]),
      requestId,
      sourceType: "notice_period",
      title: "Notice period",
      explanation: `This request was submitted with ${s.leadDays} day(s) lead time. Short notice can make handoffs harder to staff.`,
      dateRange: { start: coverage.range.start, end: coverage.range.end },
      teamId,
      roleId,
      relatedIds: { leadDays: String(s.leadDays) },
      severity: band,
    });
  }

  if (fairness.evidence.fairnessHistoryId) {
    push(bundle, null, {
      id: safeEvidenceId([requestId, "fairness_history", fairness.evidence.fairnessHistoryId]),
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

  // Ensure deterministic order for stable output and fingerprints.
  bundle.items.sort((a, b) => (a.id === b.id ? 0 : a.id < b.id ? -1 : 1));
  for (const key of Object.keys(bundle.reasonEvidenceIds)) {
    bundle.reasonEvidenceIds[key].sort();
  }

  return bundle;
}
