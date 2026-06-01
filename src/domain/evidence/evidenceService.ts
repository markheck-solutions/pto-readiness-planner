import type { DemoPtoRequest } from "../../demo/dataset";
import type { DemoRepo } from "../../repos/demoRepo";
import { calculateCoverageAssessment } from "../coverage/coverageCalculator";
import { detectConflictsForRequest } from "../conflicts/conflictDetector";
import { analyzeFairness } from "../fairness/fairnessAnalyzer";
import { scoreRisk } from "../scoring/riskScorer";
import { buildEvidenceBundle, type EvidenceItem } from "./evidenceBuilder";

export function buildEvidenceForRequest(args: {
  repo: DemoRepo;
  request: DemoPtoRequest;
  teamId: string;
  roleId: string;
}): { items: EvidenceItem[]; evidenceRefs: string[] } {
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

  return { items: evidence.items, evidenceRefs: evidence.items.map((i) => i.id) };
}
