import type {
  DemoCoverageBand,
  DemoRecommendation,
  DemoPtoRequest,
} from "../../demo/dataset";
import type { DemoRepo } from "../../repos/demoRepo";
import { calculateCoverageAssessment } from "../coverage/coverageCalculator";
import { detectConflictsForRequest } from "../conflicts/conflictDetector";
import { buildEvidenceBundle } from "../evidence/evidenceBuilder";
import { analyzeFairness } from "../fairness/fairnessAnalyzer";
import { scoreRisk } from "../scoring/riskScorer";

export type AssessmentReason = {
  code: string;
  summary: string;
  evidenceIds: string[];
};

export type PtoRequestAssessment = {
  requestId: string;
  score: number;
  band: DemoCoverageBand;
  recommendation: DemoRecommendation;
  reasons: AssessmentReason[];
  coverage: {
    teamId: string;
    roleId: string;
    range: { start: string; end: string };
    required: number;
    minAvailable: number;
    comparison: string;
    singlePersonExposure: boolean;
  };
  conflicts: ReturnType<typeof detectConflictsForRequest>;
  fairness: ReturnType<typeof analyzeFairness>;
  evidenceRefs: string[];
};

export function createAssessmentForRequest(args: {
  repo: DemoRepo;
  request: DemoPtoRequest;
  teamId: string;
  roleId: string;
}): PtoRequestAssessment {
  const { repo, request, teamId, roleId } = args;

  const range = {
    start: request.requestedStartDate,
    end: request.requestedEndDate,
  };

  const coverage = calculateCoverageAssessment({
    repo,
    teamId,
    roleId,
    range,
    includeRequestEmployeeId: request.employeeId,
  });

  const conflicts = detectConflictsForRequest({
    repo,
    requestId: request.id,
    teamId,
    roleId,
    range,
    submittedAtIso: request.submittedAt,
  });

  const fairness = analyzeFairness({
    repo,
    employeeId: request.employeeId,
    requestSubmittedAtIso: request.submittedAt,
    requestStartDate: request.requestedStartDate,
  });

  const scored = scoreRisk({ coverage, conflicts, fairness });

  const evidence = buildEvidenceBundle({
    repo,
    requestId: request.id,
    teamId,
    roleId,
    band: scored.band,
    coverage,
    conflicts,
    fairness,
    reasons: scored.reasons,
  });

  const reasons: AssessmentReason[] = scored.reasons.map((r) => ({
    code: r.code,
    summary: r.summary,
    evidenceIds: evidence.reasonEvidenceIds[r.code] ?? [],
  }));

  const evidenceRefs = evidence.items.map((i) => i.id);

  return {
    requestId: request.id,
    score: scored.score,
    band: scored.band,
    recommendation: scored.recommendation,
    reasons,
    coverage: {
      teamId,
      roleId,
      range,
      required: coverage.required,
      minAvailable: coverage.minAvailable,
      comparison: coverage.comparison,
      singlePersonExposure: coverage.singlePersonExposure,
    },
    conflicts,
    fairness,
    evidenceRefs,
  };
}
