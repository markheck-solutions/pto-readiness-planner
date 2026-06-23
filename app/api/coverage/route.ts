import { NextResponse } from "next/server";

import { jsonError, methodNotAllowed } from "../../../src/api/safeError";
import { buildCoverageMatrix } from "../../../src/domain/coverage/coverageMatrix";
import { isIsoDate, type IsoDate } from "../../../src/domain/dates";
import { getDemoRepo } from "../../../src/repos/demoRepo";

function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return fallback;
}

function presetToRange(
  preset: string,
  bounds: { startDate: IsoDate; endDate: IsoDate },
): { start: IsoDate; end: IsoDate } | null {
  if (preset === "next-8-weeks")
    return { start: bounds.startDate, end: bounds.endDate };
  if (preset === "next-12-weeks")
    return { start: bounds.startDate, end: bounds.endDate };
  return null;
}

type CoverageQuery = {
  teamId: string | null;
  roleId: string | null;
  range: { start: IsoDate; end: IsoDate };
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; response: Response };

function validateCoverageEntities(
  repo: ReturnType<typeof getDemoRepo>,
  teamId: string | null,
  roleId: string | null,
): Response | null {
  if (teamId && !repo.teams.some((t) => t.id === teamId)) {
    return jsonError(400, "invalid_request", "Unknown teamId.", { teamId });
  }
  if (roleId && !repo.roles.some((r) => r.id === roleId)) {
    return jsonError(400, "invalid_request", "Unknown roleId.", { roleId });
  }
  return null;
}

function parseExplicitCoverageRange(
  startDateRaw: string | null,
  endDateRaw: string | null,
): ParseResult<{ start: IsoDate; end: IsoDate }> {
  if (startDateRaw || endDateRaw) {
    if (!startDateRaw || !endDateRaw) {
      return {
        ok: false,
        response: jsonError(
          400,
          "invalid_request",
          "startDate and endDate must be provided together.",
        ),
      };
    }
    if (!isIsoDate(startDateRaw) || !isIsoDate(endDateRaw)) {
      return {
        ok: false,
        response: jsonError(400, "invalid_request", "Dates must be YYYY-MM-DD."),
      };
    }
    if (startDateRaw > endDateRaw) {
      return {
        ok: false,
        response: jsonError(400, "invalid_request", "Invalid date range.", {
          startDate: startDateRaw,
          endDate: endDateRaw,
        }),
      };
    }
    return { ok: true, value: { start: startDateRaw, end: endDateRaw } };
  }

  return {
    ok: false,
    response: jsonError(400, "invalid_request", "Dates were not provided."),
  };
}

function parseCoverageRange(
  url: URL,
  bounds: { startDate: IsoDate; endDate: IsoDate },
): ParseResult<{ start: IsoDate; end: IsoDate }> {
  const startDateRaw = url.searchParams.get("startDate");
  const endDateRaw = url.searchParams.get("endDate");

  if (startDateRaw || endDateRaw) {
    return parseExplicitCoverageRange(startDateRaw, endDateRaw);
  }

  const preset = url.searchParams.get("range") ?? "next-8-weeks";
  const range = presetToRange(preset, bounds);
  if (!range) {
    return {
      ok: false,
      response: jsonError(400, "invalid_request", "Invalid range preset.", {
        allowed: ["next-8-weeks", "next-12-weeks"],
      }),
    };
  }

  return { ok: true, value: range };
}

function parseCoverageQuery(
  request: Request,
  repo: ReturnType<typeof getDemoRepo>,
): ParseResult<CoverageQuery> {
  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");
  const roleId = url.searchParams.get("roleId");
  const entityError = validateCoverageEntities(repo, teamId, roleId);
  if (entityError) return { ok: false, response: entityError };

  const range = parseCoverageRange(url, repo.meta.dateBounds);
  if (!range.ok) return range;

  return { ok: true, value: { teamId, roleId, range: range.value } };
}

export async function GET(request: Request) {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);
  const repo = getDemoRepo();
  const parsed = parseCoverageQuery(request, repo);
  if (!parsed.ok) return parsed.response;

  const rows = buildCoverageMatrix({
    repo,
    range: parsed.value.range,
    teamId: parsed.value.teamId,
    roleId: parsed.value.roleId,
  });

  return NextResponse.json(
    {
      demoMode,
      datasetVersion: repo.meta.datasetVersion,
      seedFingerprint: repo.meta.seedFingerprint,
      range: parsed.value.range,
      rows,
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
