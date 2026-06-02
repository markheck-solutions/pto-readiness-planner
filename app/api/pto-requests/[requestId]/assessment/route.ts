import { NextResponse } from "next/server";

import { jsonError, methodNotAllowed } from "../../../../../src/api/safeError";
import { createAssessmentForRequest } from "../../../../../src/domain/assessment/createRequestAssessment";
import {
  getDemoRepo,
  findPtoRequestById,
} from "../../../../../src/repos/demoRepo";

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
  context: { params: Promise<{ requestId: string }> },
) {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);
  const repo = getDemoRepo();

  const { requestId } = await context.params;
  const req = findPtoRequestById(repo, requestId);
  if (!req) {
    return jsonError(404, "not_found", "Request not found.", { requestId });
  }

  const employee = repo.employees.find((e) => e.id === req.employeeId);
  if (!employee) {
    return jsonError(500, "internal_error", "Seed data is missing employee.");
  }

  const assessment = createAssessmentForRequest({
    repo,
    request: req,
    teamId: employee.teamId,
    roleId: employee.roleId,
  });

  return NextResponse.json(
    {
      demoMode,
      datasetVersion: repo.meta.datasetVersion,
      seedFingerprint: repo.meta.seedFingerprint,
      requestId: assessment.requestId,
      score: assessment.score,
      band: assessment.band,
      recommendation: assessment.recommendation,
      reasons: assessment.reasons,
      coverage: assessment.coverage,
      conflicts: assessment.conflicts,
      fairness: assessment.fairness,
      evidenceRefs: assessment.evidenceRefs,
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
