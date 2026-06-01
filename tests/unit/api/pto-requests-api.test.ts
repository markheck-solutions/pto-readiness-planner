import { describe, expect, it } from "vitest";

import {
  GET as queueGET,
  POST as queuePOST,
} from "../../../app/api/pto-requests/route";
import { GET as detailGET } from "../../../app/api/pto-requests/[requestId]/route";
import { GET as assessmentGET } from "../../../app/api/pto-requests/[requestId]/assessment/route";
import { GET as heatmapGET } from "../../../app/api/calendar-heatmap/route";
import { GET as coverageGET } from "../../../app/api/coverage/route";
import { GET as windowsGET } from "../../../app/api/critical-windows/route";
import { GET as evidenceGET } from "../../../app/api/evidence/route";

function makeReq(path: string) {
  return new Request(`http://127.0.0.1:3102${path}`);
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  expect(typeof value).toBe("object");
  expect(value).not.toBeNull();
  expect(Array.isArray(value)).toBe(false);
  return value as JsonRecord;
}

function asArray(value: unknown): unknown[] {
  expect(Array.isArray(value)).toBe(true);
  return value as unknown[];
}

describe("public PTO APIs", () => {
  it("GET /api/pto-requests supports filters individually and combined", async () => {
    const baseline = await queueGET(makeReq("/api/pto-requests"));
    expect(baseline.status).toBe(200);
    const baselineJson = asRecord((await baseline.json()) as unknown);
    expect(Array.isArray(baselineJson.items)).toBe(true);

    const byTeam = await queueGET(
      makeReq("/api/pto-requests?teamId=team_release_ops"),
    );
    expect(byTeam.status).toBe(200);
    const byTeamJson = asRecord((await byTeam.json()) as unknown);
    const byTeamItems = asArray(byTeamJson.items).map(asRecord);
    expect(
      byTeamItems.every((i) => asRecord(i.team).id === "team_release_ops"),
    ).toBe(true);

    const byRole = await queueGET(
      makeReq("/api/pto-requests?roleId=role_support_lead"),
    );
    expect(byRole.status).toBe(200);
    const byRoleJson = asRecord((await byRole.json()) as unknown);
    const byRoleItems = asArray(byRoleJson.items).map(asRecord);
    expect(byRoleItems.length).toBeGreaterThan(0);
    expect(
      byRoleItems.every((i) => asRecord(i.role).id === "role_support_lead"),
    ).toBe(true);

    const byType = await queueGET(
      makeReq("/api/pto-requests?requestType=training"),
    );
    expect(byType.status).toBe(200);
    const byTypeJson = asRecord((await byType.json()) as unknown);
    const byTypeItems = asArray(byTypeJson.items).map(asRecord);
    expect(byTypeItems.length).toBeGreaterThan(0);
    expect(byTypeItems.every((i) => i.requestType === "training")).toBe(true);

    const combined = await queueGET(
      makeReq(
        "/api/pto-requests?teamId=team_customer_support&roleId=role_support_lead&status=approved&requestType=training",
      ),
    );
    expect(combined.status).toBe(200);
    const combinedJson = asRecord((await combined.json()) as unknown);
    const combinedItems = asArray(combinedJson.items).map(asRecord);
    expect(
      combinedItems.every(
        (i) => asRecord(i.team).id === "team_customer_support",
      ),
    ).toBe(true);
    expect(
      combinedItems.every((i) => asRecord(i.role).id === "role_support_lead"),
    ).toBe(true);
    expect(combinedItems.every((i) => i.status === "approved")).toBe(true);
    expect(combinedItems.every((i) => i.requestType === "training")).toBe(true);
  });

  it("GET /api/pto-requests rejects invalid filters with controlled JSON errors", async () => {
    const res = await queueGET(makeReq("/api/pto-requests?status=bogus"));
    expect(res.status).toBe(400);
    const json = (await res.json()) as unknown;
    expect(json).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "invalid_request",
          message: expect.any(String),
        }),
      }),
    );
  });

  it("read-only endpoints reject unsupported methods with controlled JSON errors", async () => {
    const res = await queuePOST();
    expect(res.status).toBe(405);
    const json = (await res.json()) as unknown;
    expect(json).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "method_not_allowed",
          message: expect.any(String),
        }),
      }),
    );
  });

  it("GET /api/pto-requests/{id} returns safe seeded detail and 404 for unknown IDs", async () => {
    const ok = await detailGET(makeReq("/api/pto-requests/REQ-1001"), {
      params: Promise.resolve({ requestId: "REQ-1001" }),
    });
    expect(ok.status).toBe(200);
    const okJson = (await ok.json()) as unknown;
    expect(okJson).toEqual(
      expect.objectContaining({
        request: expect.objectContaining({ id: "REQ-1001" }),
        employee: expect.objectContaining({ displayName: expect.any(String) }),
        team: expect.any(Object),
        role: expect.any(Object),
      }),
    );

    const missing = await detailGET(makeReq("/api/pto-requests/NOPE"), {
      params: Promise.resolve({ requestId: "NOPE" }),
    });
    expect(missing.status).toBe(404);
    const missingJson = asRecord((await missing.json()) as unknown);
    const err = asRecord(missingJson.error);
    expect(err.code).toBe("not_found");
  });

  it("GET /api/pto-requests/{id}/assessment returns deterministic assessment with evidence refs", async () => {
    const a1 = await assessmentGET(
      makeReq("/api/pto-requests/REQ-1002/assessment"),
      { params: Promise.resolve({ requestId: "REQ-1002" }) },
    );
    const a2 = await assessmentGET(
      makeReq("/api/pto-requests/REQ-1002/assessment"),
      { params: Promise.resolve({ requestId: "REQ-1002" }) },
    );
    expect(a1.status).toBe(200);
    expect(a2.status).toBe(200);
    const j1 = asRecord((await a1.json()) as unknown);
    const j2 = asRecord((await a2.json()) as unknown);

    expect(j2.score).toBe(j1.score);
    expect(j2.band).toBe(j1.band);
    expect(j2.recommendation).toBe(j1.recommendation);
    const refs = asArray(j1.evidenceRefs);
    expect(refs.length).toBeGreaterThan(0);
  });

  it("GET /api/calendar-heatmap, /api/coverage, /api/critical-windows return safe JSON", async () => {
    const heatmap = await heatmapGET(makeReq("/api/calendar-heatmap?range=next-8-weeks"));
    expect(heatmap.status).toBe(200);
    const h = asRecord((await heatmap.json()) as unknown);
    const cells = asArray(h.cells);
    expect(cells[0]).toEqual(
      expect.objectContaining({
        date: expect.any(String),
        band: expect.any(String),
        topPressureReasons: expect.any(Array),
      }),
    );

    const coverage = await coverageGET(makeReq("/api/coverage?teamId=team_customer_support"));
    expect(coverage.status).toBe(200);
    const c = asRecord((await coverage.json()) as unknown);
    const rows = asArray(c.rows).map(asRecord);
    expect(
      rows.some(
        (r) =>
          r.comparison === "below" || r.comparison === "exact" || r.comparison === "above",
      ),
    ).toBe(true);

    const windows = await windowsGET(makeReq("/api/critical-windows"));
    expect(windows.status).toBe(200);
    const w = asRecord((await windows.json()) as unknown);
    expect(Array.isArray(w.windows)).toBe(true);
  });

  it("GET /api/evidence resolves evidence by requestId", async () => {
    const res = await evidenceGET(makeReq("/api/evidence?requestId=REQ-1004"));
    expect(res.status).toBe(200);
    const json = asRecord((await res.json()) as unknown);
    const items = asArray(json.items);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        requestId: "REQ-1004",
        sourceType: expect.any(String),
        explanation: expect.any(String),
      }),
    );
  });

  it("GET /api/evidence resolves evidence by ids", async () => {
    const baseline = await evidenceGET(makeReq("/api/evidence?requestId=REQ-1004"));
    expect(baseline.status).toBe(200);
    const baselineJson = asRecord((await baseline.json()) as unknown);
    const first = asRecord(asArray(baselineJson.items)[0]);
    const evidenceId = String(first.id);

    const res = await evidenceGET(
      makeReq(`/api/evidence?ids=${encodeURIComponent(evidenceId)}`),
    );
    expect(res.status).toBe(200);
    const json = asRecord((await res.json()) as unknown);
    const items = asArray(json.items).map(asRecord);
    expect(items.length).toBe(1);
    expect(items[0].id).toBe(evidenceId);
    expect(items[0].requestId).toBe("REQ-1004");
  });

  it("GET /api/evidence rejects present-but-empty ids with controlled JSON errors", async () => {
    const res = await evidenceGET(makeReq("/api/evidence?ids=,,,"));
    expect(res.status).toBe(400);
    const json = (await res.json()) as unknown;
    expect(json).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "invalid_request",
          message: expect.any(String),
        }),
      }),
    );
  });
});
