import Link from "next/link";

import { DemoNotice } from "../_components/DemoNotice";

type Cell = {
  weekOf: string;
  status: "Healthy" | "Thin" | "Risky" | "Critical";
  note: string;
};

const cells: Cell[] = [
  {
    weekOf: "Jun 16",
    status: "Healthy",
    note: "No critical windows and coverage above requirement.",
  },
  {
    weekOf: "Jun 23",
    status: "Thin",
    note: "Release week coverage depends on one backup for coordination.",
  },
  {
    weekOf: "Jun 30",
    status: "Risky",
    note: "Escalation role coverage drops below requirement for two days.",
  },
  {
    weekOf: "Jul 7",
    status: "Healthy",
    note: "No overlaps and on-call rotation is covered.",
  },
];

function statusClasses(status: Cell["status"]) {
  if (status === "Critical")
    return "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100";
  if (status === "Risky")
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100";
  if (status === "Thin")
    return "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-100";
  return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100";
}

export default function HeatmapPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
          Coverage heatmap (shell)
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          A manager-friendly snapshot of weeks that look healthy, thin, risky,
          or critical. This is placeholder data for the demo shell.
        </p>
      </div>

      <div className="mt-6">
        <DemoNotice compact />
      </div>

      <section aria-label="Heatmap grid" className="mt-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {cells.map((c) => (
            <div
              key={c.weekOf}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  Week of {c.weekOf}
                </div>
                <span
                  className={[
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                    statusClasses(c.status),
                  ].join(" ")}
                >
                  {c.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {c.note}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Next steps" className="mt-10 max-w-3xl">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Next step in the walkthrough
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Open a sample request to see how a manager might review coverage
          readiness before responding.
        </p>
        <div className="mt-4">
          <Link
            href="/requests/REQ-1001"
            className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Open sample request REQ-1001
          </Link>
        </div>
      </section>
    </div>
  );
}
