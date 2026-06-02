import { NextResponse } from "next/server";

import { jsonError, methodNotAllowed } from "../../../src/api/safeError";
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

function overlaps(
  a: { start: IsoDate; end: IsoDate },
  b: { start: IsoDate; end: IsoDate },
): boolean {
  return !(a.end < b.start || b.end < a.start);
}

export async function GET(request: Request) {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);
  const repo = getDemoRepo();
  const url = new URL(request.url);

  const teamId = url.searchParams.get("teamId");
  if (teamId && !repo.teams.some((t) => t.id === teamId)) {
    return jsonError(400, "invalid_request", "Unknown teamId.", { teamId });
  }

  const startDateRaw = url.searchParams.get("startDate");
  const endDateRaw = url.searchParams.get("endDate");

  let range: { start: IsoDate; end: IsoDate } = {
    start: repo.meta.dateBounds.startDate,
    end: repo.meta.dateBounds.endDate,
  };
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
  }

  const windows = repo.criticalWindows
    .filter((w) => (teamId ? w.teamId === teamId : true))
    .filter((w) => overlaps(range, { start: w.startDate, end: w.endDate }))
    .slice()
    .sort((a, b) =>
      a.startDate === b.startDate
        ? a.id < b.id
          ? -1
          : 1
        : a.startDate < b.startDate
          ? -1
          : 1,
    );

  return NextResponse.json(
    {
      demoMode,
      datasetVersion: repo.meta.datasetVersion,
      seedFingerprint: repo.meta.seedFingerprint,
      range,
      windows,
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
