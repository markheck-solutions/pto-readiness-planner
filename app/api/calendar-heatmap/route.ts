import { NextResponse } from "next/server";

import { jsonError, methodNotAllowed } from "../../../src/api/safeError";
import { buildCalendarHeatmap } from "../../../src/domain/heatmap/heatmapBuilder";
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

export async function GET(request: Request) {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);
  const repo = getDemoRepo();

  const url = new URL(request.url);
  const range = url.searchParams.get("range") ?? "next-8-weeks";
  if (range !== "next-8-weeks" && range !== "next-12-weeks") {
    return jsonError(400, "invalid_request", "Invalid range preset.", {
      allowed: ["next-8-weeks", "next-12-weeks"],
    });
  }

  const teamId = url.searchParams.get("teamId");
  const roleId = url.searchParams.get("roleId");
  if (teamId && !repo.teams.some((t) => t.id === teamId)) {
    return jsonError(400, "invalid_request", "Unknown teamId.", { teamId });
  }
  if (roleId && !repo.roles.some((r) => r.id === roleId)) {
    return jsonError(400, "invalid_request", "Unknown roleId.", { roleId });
  }

  const heatmap = buildCalendarHeatmap({
    repo,
    preset: range,
    teamId,
    roleId,
  });

  return NextResponse.json(
    {
      demoMode,
      datasetVersion: repo.meta.datasetVersion,
      seedFingerprint: repo.meta.seedFingerprint,
      range: heatmap.range,
      cells: heatmap.cells,
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
