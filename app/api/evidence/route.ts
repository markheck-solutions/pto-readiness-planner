import { NextResponse } from "next/server";

import { jsonError, methodNotAllowed } from "../../../src/api/safeError";
import { buildEvidenceForRequest } from "../../../src/domain/evidence/evidenceService";
import { getDemoRepo, findPtoRequestById } from "../../../src/repos/demoRepo";

function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return fallback;
}

function parseIds(idsRaw: string): string[] {
  return idsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function requestIdFromEvidenceId(evidenceId: string): string | null {
  // Expected format: ev_<REQUEST_ID>_...
  const m = /^ev_([^_]+)_.+/.exec(evidenceId);
  return m ? m[1] : null;
}

export async function GET(request: Request) {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);
  const repo = getDemoRepo();
  const url = new URL(request.url);

  const requestId = url.searchParams.get("requestId");
  const idsRaw = url.searchParams.get("ids");

  if (!requestId && !idsRaw) {
    return jsonError(
      400,
      "invalid_request",
      "Provide requestId or ids query parameter.",
    );
  }

  const items: Array<Record<string, unknown>> = [];

  if (requestId) {
    const req = findPtoRequestById(repo, requestId);
    if (!req) {
      return jsonError(404, "not_found", "Request not found.", { requestId });
    }
    const emp = repo.employees.find((e) => e.id === req.employeeId);
    if (!emp) {
      return jsonError(500, "internal_error", "Seed data is missing employee.");
    }
    const evidence = buildEvidenceForRequest({
      repo,
      request: req,
      teamId: emp.teamId,
      roleId: emp.roleId,
    });
    items.push(...evidence.items);
  }

  if (!requestId && idsRaw) {
    const ids = parseIds(idsRaw);
    const grouped = new Map<string, string[]>();
    for (const id of ids) {
      const rid = requestIdFromEvidenceId(id);
      if (!rid) {
        return jsonError(400, "invalid_request", "Invalid evidence id.", { id });
      }
      grouped.set(rid, [...(grouped.get(rid) ?? []), id]);
    }

    for (const [rid, desired] of grouped.entries()) {
      const req = findPtoRequestById(repo, rid);
      if (!req) {
        return jsonError(404, "not_found", "Request not found.", { requestId: rid });
      }
      const emp = repo.employees.find((e) => e.id === req.employeeId);
      if (!emp) {
        return jsonError(500, "internal_error", "Seed data is missing employee.");
      }
      const evidence = buildEvidenceForRequest({
        repo,
        request: req,
        teamId: emp.teamId,
        roleId: emp.roleId,
      });
      const wanted = new Set(desired);
      items.push(...evidence.items.filter((i) => wanted.has(i.id)));
    }
  }

  return NextResponse.json(
    {
      demoMode,
      datasetVersion: repo.meta.datasetVersion,
      seedFingerprint: repo.meta.seedFingerprint,
      items,
    },
    { status: 200 },
  );
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
export async function PUT() {
  return methodNotAllowed(["GET"]);
}
export async function PATCH() {
  return methodNotAllowed(["GET"]);
}
export async function DELETE() {
  return methodNotAllowed(["GET"]);
}
