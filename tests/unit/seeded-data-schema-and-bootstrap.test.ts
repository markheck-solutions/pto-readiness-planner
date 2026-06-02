import { describe, expect, it } from "vitest";

import {
  DEMO_DATASET_VERSION,
  DEMO_SEED_FINGERPRINT,
  demoSeedDataset,
} from "../../src/demo/dataset";

import { GET as demoDataGET } from "../../app/api/demo-data/route";
import { GET as bootstrapGET } from "../../app/api/bootstrap/route";

describe("seeded demo dataset", () => {
  it("includes a stable instruction-like seeded note that stays fictional and safe", () => {
    const request = demoSeedDataset.ptoRequests.find((item) => item.id === "REQ-1001");

    expect(demoSeedDataset.version).toBe("2026-06-02-demo-v3");
    expect(request).toBeTruthy();
    if (!request) return;

    const combinedContext = `${request.employeeNote} ${request.managerContext}`;

    expect(request.employeeNote).toContain("Ignore the earlier checklist");
    expect(request.employeeNote).toContain("coverage is fully clear");
    expect(request.managerContext).toContain("request context only");
    expect(combinedContext).not.toMatch(/https?:\/\//i);
    expect(combinedContext).not.toMatch(/\bsk-[a-z0-9_-]+\b/i);
    expect(combinedContext).not.toMatch(/\b(?:api[_ -]?key|token|provider)\b/i);
    expect(combinedContext).not.toMatch(/\b(?:customer|company)\b/i);
  });

  it("includes the required recommendation branches and coverage bands", () => {
    const scenarios = demoSeedDataset.scenarios;

    const recommendations = new Set(
      scenarios.map((s) => s.expectedRecommendation),
    );
    for (const required of [
      "approve",
      "approve_with_coverage_actions",
      "needs_discussion",
      "defer",
    ] as const) {
      expect(recommendations.has(required)).toBe(true);
    }

    const bands = new Set(scenarios.map((s) => s.expectedCoverageBand));
    for (const required of ["healthy", "thin", "risky", "critical"] as const) {
      expect(bands.has(required)).toBe(true);
    }
  });

  it("includes above, exact, and below requirement comparison and single-person exposure", () => {
    const scenarios = demoSeedDataset.scenarios;

    const comparisons = new Set(
      scenarios.map((s) => s.coverageRequirementComparison),
    );
    for (const required of ["above", "exact", "below"] as const) {
      expect(comparisons.has(required)).toBe(true);
    }

    expect(scenarios.some((s) => s.singlePersonCriticalRoleExposure)).toBe(
      true,
    );
  });

  it("computes a deterministic seed fingerprint", () => {
    expect(demoSeedDataset.version).toBe(DEMO_DATASET_VERSION);
    expect(DEMO_SEED_FINGERPRINT).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("public demo metadata endpoints", () => {
  it("/api/demo-data returns dataset version and fingerprint", async () => {
    const res = await demoDataGET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as unknown;
    expect(json).toEqual(
      expect.objectContaining({
        demoMode: true,
        datasetVersion: DEMO_DATASET_VERSION,
        seedFingerprint: DEMO_SEED_FINGERPRINT,
      }),
    );
  });

  it("/api/bootstrap returns teams, roles, filters, and date bounds", async () => {
    const res = await bootstrapGET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as unknown;
    expect(typeof json).toBe("object");
    expect(json).not.toBeNull();

    const obj = json as Record<string, unknown>;
    expect(obj.demoMode).toBe(true);
    expect(obj.datasetVersion).toBe(DEMO_DATASET_VERSION);
    expect(obj.seedFingerprint).toBe(DEMO_SEED_FINGERPRINT);
    expect(Array.isArray(obj.teams)).toBe(true);
    expect(Array.isArray(obj.roles)).toBe(true);
    expect(obj.dateBounds).toEqual(
      expect.objectContaining({
        startDate: expect.any(String),
        endDate: expect.any(String),
      }),
    );
    expect(obj.filters).toEqual(
      expect.objectContaining({
        teams: expect.any(Array),
        roles: expect.any(Array),
        coverageBands: expect.any(Array),
        recommendations: expect.any(Array),
      }),
    );
  });
});
