import Link from "next/link";

import { DemoNotice } from "../../_components/DemoNotice";

import type { IsoDate } from "../../../src/domain/dates";
import { createAssessmentForRequest } from "../../../src/domain/assessment/createRequestAssessment";
import {
  findEmployeeById,
  findPtoRequestById,
  findRoleById,
  findTeamById,
  getDemoRepo,
} from "../../../src/repos/demoRepo";
import { RequestDetailClient } from "../_components/RequestDetailClient";

function overlaps(
  a: { start: IsoDate; end: IsoDate },
  b: { start: IsoDate; end: IsoDate },
): boolean {
  return !(a.end < b.start || b.end < a.start);
}

function employeeAvailableForRange(
  repo: ReturnType<typeof getDemoRepo>,
  employeeId: string,
  range: { start: IsoDate; end: IsoDate },
): boolean {
  for (const absence of repo.existingAbsences) {
    if (absence.employeeId !== employeeId) continue;
    if (overlaps(range, { start: absence.startDate, end: absence.endDate })) {
      return false;
    }
  }

  for (const request of repo.ptoRequests) {
    if (request.employeeId !== employeeId) continue;
    if (request.status === "withdrawn") continue;
    if (
      overlaps(range, {
        start: request.requestedStartDate,
        end: request.requestedEndDate,
      })
    ) {
      return false;
    }
  }

  return true;
}

export default async function RequestDetailPage({
  params,
}: {
  params: { requestId: string } | Promise<{ requestId: string }>;
}) {
  const { requestId } = await Promise.resolve(params);
  const repo = getDemoRepo();
  const req = findPtoRequestById(repo, requestId);

  const employee = req ? findEmployeeById(repo, req.employeeId) : null;
  const team = employee ? findTeamById(repo, employee.teamId) : null;
  const role = employee ? findRoleById(repo, employee.roleId) : null;

  const assessment =
    req && employee
      ? createAssessmentForRequest({
          repo,
          request: req,
          teamId: employee.teamId,
          roleId: employee.roleId,
        })
      : null;

  const backupOptions =
    req && employee && team && role
      ? repo.employees
          .filter((candidate) => candidate.teamId === team.id)
          .filter((candidate) => candidate.roleId === role.id)
          .filter((candidate) => candidate.id !== employee.id)
          .map((candidate) => {
            const available = employeeAvailableForRange(repo, candidate.id, {
              start: req.requestedStartDate,
              end: req.requestedEndDate,
            });

            return {
              id: candidate.id,
              displayName: candidate.displayName,
              available,
              note: available
                ? "Available for the selected window."
                : "Already booked or absent during part of the selected window.",
            };
          })
          .sort((a, b) => {
            if (a.available !== b.available) return a.available ? -1 : 1;
            return a.displayName < b.displayName ? -1 : 1;
          })
      : [];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            <Link
              href="/requests"
              className="underline underline-offset-4 hover:text-zinc-950 dark:hover:text-zinc-50"
            >
              PTO requests
            </Link>{" "}
            <span aria-hidden="true">/</span> Request detail
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
            {req ? req.id : requestId}
          </h1>
        </div>
      </div>

      <div className="mt-6">
        <DemoNotice compact />
      </div>

      {req && employee && team && role && assessment ? (
        <RequestDetailClient
          key={req.id}
          request={req}
          employee={employee}
          team={team}
          role={role}
          assessment={assessment}
          backupOptions={backupOptions}
        />
      ) : (
        <section
          aria-label="Missing request"
          className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
        >
          <p className="font-medium text-zinc-950 dark:text-zinc-50">
            This request ID is not part of the demo dataset.
          </p>
          <p className="mt-2">
            Go back to the{" "}
            <Link
              href="/requests"
              className="underline underline-offset-4 hover:text-zinc-950 dark:hover:text-zinc-50"
            >
              PTO request queue
            </Link>{" "}
            to open a sample request.
          </p>
        </section>
      )}
    </div>
  );
}
