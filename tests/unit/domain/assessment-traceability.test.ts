import { describe, expect, it } from "vitest";

import { createAssessmentForRequest } from "../../../src/domain/assessment/createRequestAssessment";
import { getDemoRepo } from "../../../src/repos/demoRepo";

describe("assessment traceability", () => {
  it("adds an explainable coverage reason and evidence for healthy approvals", () => {
    const repo = getDemoRepo();
    const request = repo.ptoRequests.find((r) => r.id === "REQ-1003");
    expect(request).toBeTruthy();
    if (!request) return;

    const employee = repo.employees.find((e) => e.id === request.employeeId);
    expect(employee).toBeTruthy();
    if (!employee) return;

    const assessment = createAssessmentForRequest({
      repo,
      request,
      teamId: employee.teamId,
      roleId: employee.roleId,
    });

    expect(assessment.recommendation).toBe("approve");
    expect(assessment.band).toBe("healthy");
    expect(assessment.reasons.map((r) => r.code)).toContain(
      "coverage_above_requirement",
    );
    expect(
      assessment.reasons.every((reason) => reason.evidenceIds.length > 0),
    ).toBe(true);
  });

  it("keeps top recommendation reasons tied to seeded evidence for high-pressure requests", () => {
    const repo = getDemoRepo();
    const request = repo.ptoRequests.find((r) => r.id === "REQ-1001");
    expect(request).toBeTruthy();
    if (!request) return;

    const employee = repo.employees.find((e) => e.id === request.employeeId);
    expect(employee).toBeTruthy();
    if (!employee) return;

    const assessment = createAssessmentForRequest({
      repo,
      request,
      teamId: employee.teamId,
      roleId: employee.roleId,
    });

    expect(assessment.reasons.length).toBeGreaterThan(0);
    for (const reason of assessment.reasons) {
      expect(reason.evidenceIds.length).toBeGreaterThan(0);
    }
    expect(assessment.evidenceRefs.length).toBeGreaterThan(0);
  });
});
