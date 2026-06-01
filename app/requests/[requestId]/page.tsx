import Link from "next/link";

import { DemoNotice } from "../../_components/DemoNotice";
import { SimulatedDecisionControls } from "../../_components/SimulatedDecisionControls";
import { findDemoPtoRequestById } from "../../../lib/demo-samples";

export default function RequestDetailPage({
  params,
}: {
  params: { requestId: string };
}) {
  const request = findDemoPtoRequestById(params.requestId);

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
            {request ? request.id : params.requestId}
          </h1>
        </div>
      </div>

      <div className="mt-6">
        <DemoNotice compact />
      </div>

      {request ? (
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
                {request.employeeName}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Dates
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {request.dateRange}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Team
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {request.team}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Role
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {request.role}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Summary
              </div>
              <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                {request.summary}
              </div>
            </div>
          </section>

          <section aria-label="Readiness framing" className="mt-10 max-w-3xl">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Coverage readiness framing
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              This page is a shell. Later milestones will replace the text below
              with computed risk, evidence, overlaps, and critical window
              checks.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              <li>
                Risk band:{" "}
                <span className="font-medium">{request.riskBand}</span>
              </li>
              <li>
                Suggested next step:{" "}
                <span className="font-medium">{request.recommendation}</span>
              </li>
              <li>
                Top consideration:{" "}
                <span className="font-medium">{request.topReason}</span>
              </li>
            </ul>
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
            This request ID is not part of the demo shell yet.
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
