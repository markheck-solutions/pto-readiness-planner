import { NextResponse } from "next/server";

import { jsonError, methodNotAllowed } from "../../../../src/api/safeError";
import { getDemoRepo, findPtoRequestById } from "../../../../src/repos/demoRepo";

function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return fallback;
}

export async function GET(
  _request: Request,
  context: { params: { requestId: string } },
) {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);
  const repo = getDemoRepo();

  const requestId = context.params.requestId;
  const req = findPtoRequestById(repo, requestId);
  if (!req) {
    return jsonError(404, "not_found", "Request not found.", { requestId });
  }

  const employee = repo.employees.find((e) => e.id === req.employeeId);
  if (!employee) {
    return jsonError(500, "internal_error", "Seed data is missing employee.");
  }
  const team = repo.teams.find((t) => t.id === employee.teamId);
  const role = repo.roles.find((r) => r.id === employee.roleId);
  if (!team || !role) {
    return jsonError(500, "internal_error", "Seed data is missing team or role.");
  }

  return NextResponse.json(
    {
      demoMode,
      datasetVersion: repo.meta.datasetVersion,
      seedFingerprint: repo.meta.seedFingerprint,
      request: {
        id: req.id,
        requestType: req.requestType,
        status: req.status,
        requestedStartDate: req.requestedStartDate,
        requestedEndDate: req.requestedEndDate,
        submittedAt: req.submittedAt,
        employeeNote: req.employeeNote,
        managerContext: req.managerContext,
      },
      employee: { id: employee.id, displayName: employee.displayName },
      team: { id: team.id, name: team.name },
      role: { id: role.id, name: role.name },
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
