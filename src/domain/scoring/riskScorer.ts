import type { DemoCoverageBand, DemoRecommendation } from "../../demo/dataset";
import type { CoverageAssessment } from "../coverage/coverageCalculator";
import type { ConflictAssessment, ConflictItem } from "../conflicts/conflictDetector";
import type { FairnessAssessment } from "../fairness/fairnessAnalyzer";

export type RiskReason = {
  code:
    | "coverage_above_requirement"
    | "coverage_below_requirement"
    | "coverage_exact_requirement"
    | "single_person_role_exposure"
    | "critical_window_overlap"
    | "overlapping_absence"
    | "overlapping_request"
    | "short_notice"
    | "fairness_context";
  summary: string;
};

export type RiskScoreResult = {
  score: number; // 0..100
  band: DemoCoverageBand;
  recommendation: DemoRecommendation;
  reasons: RiskReason[];
  breakdown: Record<string, number>;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function bandFromScore(score: number): DemoCoverageBand {
  if (score >= 75) return "critical";
  if (score >= 50) return "risky";
  if (score >= 25) return "thin";
  return "healthy";
}

function recommendationFromBand(band: DemoCoverageBand): DemoRecommendation {
  if (band === "critical") return "defer";
  if (band === "risky") return "needs_discussion";
  if (band === "thin") return "approve_with_coverage_actions";
  return "approve";
}

function hasConflictKind(
  conflicts: ConflictAssessment,
  kind: ConflictItem["kind"],
) {
  return conflicts.items.some((c) => c.kind === kind);
}

function criticalWindowScore(conflicts: ConflictAssessment): number {
  const windows = conflicts.items.filter(
    (c) => c.kind === "critical_window",
  ) as Array<Extract<ConflictItem, { kind: "critical_window" }>>;
  if (windows.length === 0) return 0;
  if (windows.some((w) => w.windowKind === "blackout")) return 15;
  return 8;
}

export function scoreRisk(args: {
  coverage: CoverageAssessment;
  conflicts: ConflictAssessment;
  fairness: FairnessAssessment;
}): RiskScoreResult {
  const { coverage, conflicts } = args;

  const breakdown: Record<string, number> = {};
  const reasons: RiskReason[] = [];

  if (coverage.comparison === "below") {
    breakdown.coverage = 50;
    reasons.push({
      code: "coverage_below_requirement",
      summary: `Coverage drops below the role minimum (required ${coverage.required}, available as low as ${coverage.minAvailable}).`,
    });
  } else if (coverage.comparison === "exact") {
    breakdown.coverage = 25;
    reasons.push({
      code: "coverage_exact_requirement",
      summary: `Coverage sits at the role minimum (required ${coverage.required}, available as low as ${coverage.minAvailable}).`,
    });
  } else {
    breakdown.coverage = 5;
    reasons.push({
      code: "coverage_above_requirement",
      summary: `Coverage stays above the role minimum (required ${coverage.required}, available as low as ${coverage.minAvailable}).`,
    });
  }

  if (coverage.singlePersonExposure) {
    breakdown.singlePersonExposure = 25;
    reasons.push({
      code: "single_person_role_exposure",
      summary: "This role has single-person coverage. If approved, there is no backup in the same role for at least one day.",
    });
  }

  const cwScore = criticalWindowScore(conflicts);
  if (cwScore > 0) {
    breakdown.criticalWindows = cwScore;
    reasons.push({
      code: "critical_window_overlap",
      summary: "The requested dates overlap a critical window where coverage gaps have outsized impact.",
    });
  }

  if (hasConflictKind(conflicts, "overlapping_absence")) {
    breakdown.overlappingAbsence = 10;
    reasons.push({
      code: "overlapping_absence",
      summary: "An existing absence overlaps the requested dates for the same role, increasing coverage pressure.",
    });
  }

  if (hasConflictKind(conflicts, "overlapping_request")) {
    breakdown.overlappingRequest = 10;
    reasons.push({
      code: "overlapping_request",
      summary: "Another request overlaps the same role and dates. Confirm the plan before stacking approvals.",
    });
  }

  if (hasConflictKind(conflicts, "short_notice")) {
    breakdown.shortNotice = 5;
    reasons.push({
      code: "short_notice",
      summary: "Short notice reduces time to staff handoffs and confirm backup coverage.",
    });
  }

  // Fairness is context only. Do not score it as a risk factor.
  breakdown.fairnessContext = 0;

  const score = clampScore(Object.values(breakdown).reduce((a, b) => a + b, 0));
  const band = bandFromScore(score);
  const recommendation = recommendationFromBand(band);

  return { score, band, recommendation, reasons, breakdown };
}
