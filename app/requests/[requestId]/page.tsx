import Link from "next/link";

import { DemoNotice } from "../../_components/DemoNotice";
import { SimulatedDecisionControls } from "../../_components/SimulatedDecisionControls";

import { RecommendationBadge, RiskBadge } from "../../_components/StatusBadges";

import { parseIsoDate, type IsoDate } from "../../../src/domain/dates";
import { createAssessmentForRequest } from "../../../src/domain/assessment/createRequestAssessment";
import {
  findEmployeeById,
  findPtoRequestById,
  findRoleById,
  findTeamById,
  getDemoRepo,
} from "../../../src/repos/demoRepo";

function formatShortDay(iso: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(iso));
}

function formatDateRange(start: IsoDate, end: IsoDate): string {
  if (start === end) return formatShortDay(start);
  return `${formatShortDay(start)} to ${formatShortDay(end)}`;
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
        <>
          <section
            aria-label="Request summary"
            className="mt-8 grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-2"
          >
            <div>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Employee
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {employee.displayName}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Dates
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {formatDateRange(req.requestedStartDate, req.requestedEndDate)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Team
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {team.name}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Role
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {role.name}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Request type
                  </div>
                  <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {req.requestType.toUpperCase()} · Status: {req.status}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Submitted
                  </div>
                  <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(req.submittedAt))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Coverage readiness snapshot" className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  Coverage readiness snapshot
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  Deterministic demo assessment. You can trace the recommendation back to seeded facts.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <RiskBadge band={assessment.band} score={assessment.score} />
                <RecommendationBadge recommendation={assessment.recommendation} />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Top reasons
              </div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {assessment.reasons.slice(0, 3).map((r) => (
                  <li key={r.code}>
                    <span className="font-medium text-zinc-950 dark:text-zinc-50">
                      {r.summary}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium text-zinc-950 dark:text-zinc-50">
                  Manager context:
                </span>{" "}
                {req.managerContext}
              </div>
              <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium text-zinc-950 dark:text-zinc-50">
                  Employee note:
                </span>{" "}
                {req.employeeNote}
              </div>
            </div>
          </section>

          <section aria-label="Demo actions" className="mt-10 max-w-3xl">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Manager actions (demo only)
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              These controls do not save anything. They are browser-only
              simulation and reset on refresh.
            </p>
            <div className="mt-4">
              <SimulatedDecisionControls />
            </div>
          </section>
        </>
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
