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

type EvidenceItemsResult =
  | { ok: true; items: Array<Record<string, unknown>> }
  | { ok: false; response: Response };

function evidenceItemsForRequestId(
  repo: ReturnType<typeof getDemoRepo>,
  requestId: string,
): EvidenceItemsResult {
  const req = findPtoRequestById(repo, requestId);
  if (!req) {
    return {
      ok: false,
      response: jsonError(404, "not_found", "Request not found.", {
        requestId,
      }),
    };
  }
  const emp = repo.employees.find((e) => e.id === req.employeeId);
  if (!emp) {
    return {
      ok: false,
      response: jsonError(
        500,
        "internal_error",
        "Seed data is missing employee.",
      ),
    };
  }
  const evidence = buildEvidenceForRequest({
    repo,
    request: req,
    teamId: emp.teamId,
    roleId: emp.roleId,
  });
  return { ok: true, items: evidence.items };
}

function groupEvidenceIds(ids: string[]) {
  const grouped = new Map<string, string[]>();

  for (const id of ids) {
    const requestId = requestIdFromEvidenceId(id);
    if (!requestId) {
      return {
        ok: false as const,
        response: jsonError(400, "invalid_request", "Invalid evidence id.", {
          id,
        }),
      };
    }
    grouped.set(requestId, [...(grouped.get(requestId) ?? []), id]);
  }

  return { ok: true as const, grouped };
}

function evidenceItemsForIds(
  repo: ReturnType<typeof getDemoRepo>,
  idsRaw: string,
): EvidenceItemsResult {
  const ids = parseIds(idsRaw);
  if (ids.length === 0) {
    return {
      ok: false,
      response: jsonError(
        400,
        "invalid_request",
        "Provide at least one evidence id.",
      ),
    };
  }

  const groupedIds = groupEvidenceIds(ids);
  if (!groupedIds.ok) return groupedIds;

  const items: Array<Record<string, unknown>> = [];
  for (const [requestId, desired] of groupedIds.grouped.entries()) {
    const evidence = evidenceItemsForRequestId(repo, requestId);
    if (!evidence.ok) return evidence;
    const wanted = new Set(desired);
    items.push(...evidence.items.filter((item) => wanted.has(String(item.id))));
  }

  return { ok: true, items };
}

function resolveEvidenceItems(
  repo: ReturnType<typeof getDemoRepo>,
  url: URL,
): EvidenceItemsResult {
  const requestId = url.searchParams.get("requestId");
  if (requestId) return evidenceItemsForRequestId(repo, requestId);

  const idsRaw = url.searchParams.get("ids");
  if (idsRaw) return evidenceItemsForIds(repo, idsRaw);

  return {
    ok: false,
    response: jsonError(
      400,
      "invalid_request",
      "Provide requestId or ids query parameter.",
    ),
  };
}

export async function GET(request: Request) {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);
  const repo = getDemoRepo();
  const url = new URL(request.url);
  const resolved = resolveEvidenceItems(repo, url);
  if (!resolved.ok) return resolved.response;

  return NextResponse.json(
    {
      demoMode,
      datasetVersion: repo.meta.datasetVersion,
      seedFingerprint: repo.meta.seedFingerprint,
      items: resolved.items,
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
