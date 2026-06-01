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
  if (preset === "next-8-weeks") return { start: bounds.startDate, end: bounds.endDate };
  if (preset === "next-12-weeks") return { start: bounds.startDate, end: bounds.endDate };
  return null;
}

export async function GET(request: Request) {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);
  const repo = getDemoRepo();
  const url = new URL(request.url);

  const teamId = url.searchParams.get("teamId");
  const roleId = url.searchParams.get("roleId");

  if (teamId && !repo.teams.some((t) => t.id === teamId)) {
    return jsonError(400, "invalid_request", "Unknown teamId.", { teamId });
  }
  if (roleId && !repo.roles.some((r) => r.id === roleId)) {
    return jsonError(400, "invalid_request", "Unknown roleId.", { roleId });
  }

  const startDateRaw = url.searchParams.get("startDate");
  const endDateRaw = url.searchParams.get("endDate");
  const preset = url.searchParams.get("range") ?? "next-8-weeks";

  let range: { start: IsoDate; end: IsoDate } | null = null;

  if (startDateRaw || endDateRaw) {
    if (!startDateRaw || !endDateRaw) {
      return jsonError(
        400,
        "invalid_request",
        "startDate and endDate must be provided together.",
      );
    }
    if (!isIsoDate(startDateRaw) || !isIsoDate(endDateRaw)) {
      return jsonError(400, "invalid_request", "Dates must be YYYY-MM-DD.");
    }
    if (startDateRaw > endDateRaw) {
      return jsonError(400, "invalid_request", "Invalid date range.", {
        startDate: startDateRaw,
        endDate: endDateRaw,
      });
    }
    range = { start: startDateRaw, end: endDateRaw };
  } else {
    range = presetToRange(preset, repo.meta.dateBounds);
    if (!range) {
      return jsonError(400, "invalid_request", "Invalid range preset.", {
        allowed: ["next-8-weeks", "next-12-weeks"],
      });
    }
  }

  const rows = buildCoverageMatrix({
    repo,
    range,
    teamId,
    roleId,
  });

  return NextResponse.json(
    {
      demoMode,
      datasetVersion: repo.meta.datasetVersion,
      seedFingerprint: repo.meta.seedFingerprint,
      range,
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
