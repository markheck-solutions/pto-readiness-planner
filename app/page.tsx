import Link from "next/link";

import { DemoNotice } from "./_components/DemoNotice";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <section aria-label="Overview" className="max-w-3xl">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
          PTO coverage readiness decision support for managers
        </h1>
        <p className="mt-4 text-pretty text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
          Review PTO requests through role coverage risk, overlaps, and upcoming
          delivery windows. This is a minimal demo shell intended for portfolio
          review, not a live HR workflow.
        </p>
      </section>

      <div className="mt-8">
        <DemoNotice />
      </div>

      <section aria-label="Demo navigation" className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Start a quick walkthrough
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Link
            href="/requests"
            className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
          >
            <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              PTO request queue
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              A small fictional queue with manager-friendly risk framing.
            </p>
            <div className="mt-4 text-sm font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50">
              Open Requests
            </div>
          </Link>

          <Link
            href="/heatmap"
            className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
          >
            <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Coverage heatmap
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              A weekly snapshot of coverage pressure and critical windows.
            </p>
            <div className="mt-4 text-sm font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50">
              Open Coverage
            </div>
          </Link>

          <Link
            href="/requests/REQ-1001"
            className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
          >
            <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Sample request detail
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              What a manager reviews before approving, deferring, or asking for
              coverage.
            </p>
            <div className="mt-4 text-sm font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50">
              Open Sample
            </div>
          </Link>
        </div>
      </section>

      <section aria-label="Scope notes" className="mt-12 max-w-3xl">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          What this shell does (and does not) do
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          <li>
            Shows the manager-facing framing: coverage risk, overlaps, critical
            windows, and evidence-backed recommendations.
          </li>
          <li>
            Does not store approvals or write to any HR system. Any future
            interactions stay in browser state only.
          </li>
          <li>
            Keeps the public demo posture obvious: fictional data only and mock
            outputs.
          </li>
        </ul>
      </section>
    </div>
  );
}
