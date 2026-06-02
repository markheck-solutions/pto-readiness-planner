"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useBrowserDecisions } from "../_components/BrowserDecisionProvider";
import { QueueResultsTable, type QueueTableRow } from "./QueueResultsTable";

import {
  decisionLabel,
  matchesDecisionFilter,
  type DemoDecision,
} from "../../src/domain/simulation";

type QueueResultsPanelProps = {
  rows: QueueTableRow[];
  demoDecisionFilter: DemoDecision | null;
  clearAllHref: string;
  clearDemoDecisionHref: string;
};

export function QueueResultsPanel({
  rows,
  demoDecisionFilter,
  clearAllHref,
  clearDemoDecisionHref,
}: QueueResultsPanelProps) {
  const { decisions } = useBrowserDecisions();

  const visibleRows = useMemo(
    () =>
      rows.filter((row) =>
        matchesDecisionFilter(decisions[row.id] ?? "none", demoDecisionFilter),
      ),
    [decisions, demoDecisionFilter, rows],
  );

  const requestCountLabel = `Showing ${visibleRows.length} request${visibleRows.length === 1 ? "" : "s"}.`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Showing{" "}
          <span className="font-mono font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
            {visibleRows.length}
          </span>{" "}
          request{visibleRows.length === 1 ? "" : "s"}.
        </div>
        {demoDecisionFilter ? (
          <p className="max-w-xl text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            Demo decision filter: {decisionLabel(demoDecisionFilter)}. This
            browser-session filter resets on refresh.
          </p>
        ) : null}
      </div>

      <div className="sr-only" aria-live="polite">
        Queue results updated. {requestCountLabel}
      </div>

      {visibleRows.length === 0 ? (
        demoDecisionFilter && rows.length > 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
            <p className="font-medium text-zinc-950 dark:text-zinc-50">
              No requests in this browser session match the current demo
              decision filter.
            </p>
            <p className="mt-2">
              Change the demo action, clear the demo decision filter, or reset
              the queue view. Refreshing the page also clears simulated actions.
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link
                href={clearDemoDecisionHref}
                className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
              >
                Clear the demo decision filter
              </Link>
              <Link
                href={clearAllHref}
                className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
              >
                Clear filters and show the full queue
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
            <p className="font-medium text-zinc-950 dark:text-zinc-50">
              No requests match the current filters.
            </p>
            <p className="mt-2">
              Try clearing filters, broadening the date range, or selecting a
              different team.
            </p>
            <div className="mt-4">
              <Link
                href={clearAllHref}
                className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
              >
                Clear filters and show the full queue
              </Link>
            </div>
          </div>
        )
      ) : (
        <QueueResultsTable items={visibleRows} />
      )}
    </div>
  );
}
