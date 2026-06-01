import Link from "next/link";

import { DemoNotice } from "../_components/DemoNotice";
import { demoPtoRequests } from "../../lib/demo-samples";

function riskPillClasses(riskBand: string) {
  if (riskBand === "High")
    return "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100";
  if (riskBand === "Medium")
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100";
  return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100";
}

export default function RequestsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
          PTO requests
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          This is a demo shell. The queue below is a small set of fictional
          requests to illustrate the manager-facing framing.
        </p>
      </div>

      <div className="mt-6">
        <DemoNotice compact />
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600 dark:bg-zinc-950/40 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Request</th>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Dates</th>
              <th className="px-4 py-3 font-medium">Risk</th>
              <th className="px-4 py-3 font-medium">Recommendation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {demoPtoRequests.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-4">
                  <div className="font-medium text-zinc-950 dark:text-zinc-50">
                    <Link
                      href={`/requests/${r.id}`}
                      className="underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      {r.id}
                    </Link>
                  </div>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {r.employeeName}
                  </div>
                  <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {r.topReason}
                  </div>
                </td>
                <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                  {r.team}
                </td>
                <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                  {r.role}
                </td>
                <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                  {r.dateRange}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={[
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                      riskPillClasses(r.riskBand),
                    ].join(" ")}
                    aria-label={`Risk band: ${r.riskBand}`}
                  >
                    {r.riskBand}
                  </span>
                </td>
                <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                  {r.recommendation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
