import { describe, expect, it } from "vitest";

import { demoSeedDataset } from "../../../src/demo/dataset";
import { createAssessmentForRequest } from "../../../src/domain/assessment/createRequestAssessment";
import { getDemoRepo } from "../../../src/repos/demoRepo";

describe("deterministic request assessment scenarios", () => {
  it("matches the seeded scenario expectations for recommendation and band", () => {
    const repo = getDemoRepo();

    for (const scenario of demoSeedDataset.scenarios) {
      const req =
        repo.ptoRequests.find((r) => r.id === scenario.requestId) ?? null;
      expect(
        req,
        `missing request for scenario: ${scenario.id}`,
      ).not.toBeNull();
      if (!req) continue;

      const emp = repo.employees.find((e) => e.id === req.employeeId) ?? null;
      expect(emp, `missing employee for request: ${req.id}`).not.toBeNull();
      if (!emp) continue;

      const assessment = createAssessmentForRequest({
        repo,
        request: req,
        teamId: emp.teamId,
        roleId: emp.roleId,
      });

      expect(assessment.recommendation, scenario.id).toBe(
        scenario.expectedRecommendation,
      );
      expect(assessment.band, scenario.id).toBe(scenario.expectedCoverageBand);
    }
  });

  it("produces stable score, band, recommendation, and evidence refs for the same request", () => {
    const repo = getDemoRepo();
    const req = repo.ptoRequests.find((r) => r.id === "REQ-1001");
    expect(req).toBeTruthy();
    if (!req) return;

    const emp = repo.employees.find((e) => e.id === req.employeeId);
    expect(emp).toBeTruthy();
    if (!emp) return;

    const a1 = createAssessmentForRequest({
      repo,
      request: req,
      teamId: emp.teamId,
      roleId: emp.roleId,
    });
    const a2 = createAssessmentForRequest({
      repo,
      request: req,
      teamId: emp.teamId,
      roleId: emp.roleId,
    });

    expect(a2.score).toBe(a1.score);
    expect(a2.band).toBe(a1.band);
    expect(a2.recommendation).toBe(a1.recommendation);
    expect(a2.evidenceRefs).toEqual(a1.evidenceRefs);
  });

  it("keeps fairness language non-punitive and non-sensitive", () => {
    const repo = getDemoRepo();
    const req = repo.ptoRequests.find((r) => r.id === "REQ-1002");
    expect(req).toBeTruthy();
    if (!req) return;

    const emp = repo.employees.find((e) => e.id === req.employeeId);
    expect(emp).toBeTruthy();
    if (!emp) return;

    const assessment = createAssessmentForRequest({
      repo,
      request: req,
      teamId: emp.teamId,
      roleId: emp.roleId,
    });

    const text = [
      assessment.fairness.note,
      ...assessment.fairness.signals.map((s) => s.message),
    ].join(" ");

    const forbidden = [
      "medical",
      "diagnosis",
      "compensation",
      "salary",
      "performance",
      "discipline",
      "punish",
      "protected",
    ];
    for (const term of forbidden) {
      expect(text.toLowerCase()).not.toContain(term);
    }
  });
});
