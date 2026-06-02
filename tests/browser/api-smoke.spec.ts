import { expect, test } from "@playwright/test";

const FORBIDDEN_LEAK_PATTERNS = [
  /DATABASE_URL/i,
  /OPENAI_COMPATIBLE_API_KEY/i,
  /OPENAI_COMPATIBLE_BASE_URL\s*[:=]\s*["']?https?:\/\//i,
  /\bsk-[a-z0-9_-]{8,}\b/i,
  /\bpostgres(?:ql)?:\/\/[^/\s]+/i,
];

function expectNoLeaks(payload: unknown) {
  const text =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);

  for (const pattern of FORBIDDEN_LEAK_PATTERNS) {
    expect(text).not.toMatch(pattern);
  }
}

test("public APIs stay read-only, deterministic, and demo-safe", async ({
  request,
}) => {
  const healthResponse = await request.get("/api/health");
  expect(healthResponse.ok()).toBe(true);
  const healthJson = (await healthResponse.json()) as {
    service: string;
    demoMode: boolean;
    capabilities: Record<string, unknown>;
    build: Record<string, unknown>;
  };
  expect(healthJson.service).toBe("pto-readiness-planner");
  expect(healthJson.demoMode).toBe(true);
  expect(healthJson.capabilities).toBeTruthy();
  expect(healthJson.build).toBeTruthy();
  expectNoLeaks(healthJson);

  const demoDataResponse = await request.get("/api/demo-data");
  expect(demoDataResponse.ok()).toBe(true);
  const demoDataJson = (await demoDataResponse.json()) as {
    demoMode: boolean;
    datasetVersion: string;
    seedFingerprint: string;
  };
  expect(demoDataJson.demoMode).toBe(true);
  expect(demoDataJson.datasetVersion).toMatch(/^2026-/);
  expect(demoDataJson.seedFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expectNoLeaks(demoDataJson);

  const bootstrapResponse = await request.get("/api/bootstrap");
  expect(bootstrapResponse.ok()).toBe(true);
  const bootstrapJson = (await bootstrapResponse.json()) as {
    teams: unknown[];
    roles: unknown[];
    filters: Record<string, unknown>;
  };
  expect(bootstrapJson.teams.length).toBeGreaterThan(0);
  expect(bootstrapJson.roles.length).toBeGreaterThan(0);
  expect(bootstrapJson.filters).toBeTruthy();
  expectNoLeaks(bootstrapJson);

  const queueResponse = await request.get("/api/pto-requests");
  expect(queueResponse.ok()).toBe(true);
  const queueJson = (await queueResponse.json()) as {
    items: Array<{ id: string }>;
  };
  expect(queueJson.items.map((item) => item.id)).toContain("REQ-1001");
  expectNoLeaks(queueJson);

  const detailResponse = await request.get("/api/pto-requests/REQ-1001");
  expect(detailResponse.ok()).toBe(true);
  const detailJson = (await detailResponse.json()) as {
    request: { id: string };
    employee: { displayName: string };
  };
  expect(detailJson.request.id).toBe("REQ-1001");
  expect(detailJson.employee.displayName).toBe("Avery Park");
  expectNoLeaks(detailJson);

  const assessmentResponse = await request.get(
    "/api/pto-requests/REQ-1001/assessment",
  );
  expect(assessmentResponse.ok()).toBe(true);
  const assessmentJson = (await assessmentResponse.json()) as {
    score: number;
    band: string;
    recommendation: string;
    evidenceRefs: string[];
  };
  expect(assessmentJson.score).toBeGreaterThan(0);
  expect(assessmentJson.band).toBeTruthy();
  expect(assessmentJson.recommendation).toBeTruthy();
  expect(assessmentJson.evidenceRefs.length).toBeGreaterThan(0);
  expectNoLeaks(assessmentJson);

  const heatmapResponse = await request.get("/api/calendar-heatmap");
  expect(heatmapResponse.ok()).toBe(true);
  const heatmapJson = (await heatmapResponse.json()) as {
    cells: unknown[];
  };
  expect(heatmapJson.cells.length).toBeGreaterThan(0);
  expectNoLeaks(heatmapJson);

  const coverageResponse = await request.get("/api/coverage");
  expect(coverageResponse.ok()).toBe(true);
  const coverageJson = (await coverageResponse.json()) as {
    rows: unknown[];
  };
  expect(coverageJson.rows.length).toBeGreaterThan(0);
  expectNoLeaks(coverageJson);

  const windowsResponse = await request.get("/api/critical-windows");
  expect(windowsResponse.ok()).toBe(true);
  const windowsJson = (await windowsResponse.json()) as {
    windows: unknown[];
  };
  expect(windowsJson.windows.length).toBeGreaterThan(0);
  expectNoLeaks(windowsJson);

  const evidenceResponse = await request.get(
    "/api/evidence?requestId=REQ-1001",
  );
  expect(evidenceResponse.ok()).toBe(true);
  const evidenceJson = (await evidenceResponse.json()) as {
    items: unknown[];
  };
  expect(evidenceJson.items.length).toBeGreaterThan(0);
  expectNoLeaks(evidenceJson);

  const draftResponse = await request.post("/api/manager-draft", {
    data: {
      requestId: "REQ-1001",
      action: "approve_with_coverage_actions",
    },
  });
  expect(draftResponse.ok()).toBe(true);
  const draftJson = (await draftResponse.json()) as {
    requestId: string;
    action: string;
    draft: string;
    meta: { source: string; simulationOnly: boolean };
  };
  expect(draftJson.requestId).toBe("REQ-1001");
  expect(draftJson.action).toBe("approve_with_coverage_actions");
  expect(draftJson.meta.source).toBe("mock");
  expect(draftJson.meta.simulationOnly).toBe(true);
  expect(draftJson.draft).toContain("Avery Park");
  expectNoLeaks(draftJson);
});

test("controlled API errors stay safe and unsupported methods are rejected", async ({
  request,
}) => {
  const invalidFilterResponse = await request.get(
    "/api/pto-requests?status=bogus",
  );
  expect(invalidFilterResponse.status()).toBe(400);
  const invalidFilterJson = (await invalidFilterResponse.json()) as {
    error: { code: string; message: string };
  };
  expect(invalidFilterJson.error.code).toBe("invalid_request");
  expect(invalidFilterJson.error.message).toMatch(/status/i);
  expectNoLeaks(invalidFilterJson);

  const invalidEvidenceResponse = await request.get("/api/evidence?ids=,,,");
  expect(invalidEvidenceResponse.status()).toBe(400);
  const invalidEvidenceJson = (await invalidEvidenceResponse.json()) as {
    error: { code: string; message: string };
  };
  expect(invalidEvidenceJson.error.code).toBe("invalid_request");
  expectNoLeaks(invalidEvidenceJson);

  const overrideResponse = await request.post("/api/manager-draft", {
    data: {
      requestId: "REQ-1001",
      action: "approve",
      provider: "local",
    },
  });
  expect(overrideResponse.status()).toBe(400);
  const overrideJson = (await overrideResponse.json()) as {
    error: { code: string; message: string };
  };
  expect(overrideJson.error.code).toBe("invalid_request");
  expectNoLeaks(overrideJson);

  const methodResponse = await request.fetch("/api/pto-requests", {
    method: "POST",
  });
  expect(methodResponse.status()).toBe(405);
  const methodJson = (await methodResponse.json()) as {
    error: { code: string; message: string };
  };
  expect(methodJson.error.code).toBe("method_not_allowed");
  expectNoLeaks(methodJson);
});
