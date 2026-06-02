"use client";

import { useMemo } from "react";

import { useBrowserDecisions } from "../_components/BrowserDecisionProvider";
import { ResetQueueFiltersLink } from "./ResetQueueFiltersLink";
import { QueueResultsTable, type QueueTableRow } from "./QueueResultsTable";

import {
  decisionLabel,
  matchesDecisionFilter,
  type DemoDecision,
} from "../../src/domain/simulation";

type QueueResultsPanelProps = {
  rows: QueueTableRow[];
  clearAllHref: string;
};

export function QueueResultsPanel({
  rows,
  clearAllHref,
}: QueueResultsPanelProps) {
  const {
    decisions,
    decisionFilter,
    setDecisionFilter,
    clearDecisionFilter,
  } = useBrowserDecisions();

  const visibleRows = useMemo(
    () =>
      rows.filter((row) =>
        matchesDecisionFilter(decisions[row.id] ?? "none", decisionFilter),
      ),
    [decisionFilter, decisions, rows],
  );

  const requestCountLabel = `Showing ${visibleRows.length} request${visibleRows.length === 1 ? "" : "s"}.`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Showing{" "}
            <span className="font-mono font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
              {visibleRows.length}
            </span>{" "}
            request{visibleRows.length === 1 ? "" : "s"}.
          </div>
          {decisionFilter ? (
            <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-600 dark:text-zinc-400">
              Demo decision filter: {decisionLabel(decisionFilter)}. This
              browser-session filter resets on refresh.
            </p>
          ) : (
            <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-600 dark:text-zinc-400">
              Demo decision filtering is session-only. URL state ignores stale
              browser actions and refresh clears simulated decisions.
            </p>
          )}
        </div>

        <div className="min-w-60 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <label
            htmlFor="session-demo-decision-filter"
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Demo decision filter
          </label>
          <select
            id="session-demo-decision-filter"
            aria-label="Demo decision filter"
            value={decisionFilter ?? ""}
            onChange={(event) => {
              const nextValue = event.target.value as DemoDecision | ""
              if (!nextValue) {
                clearDecisionFilter()
                return
              }
              setDecisionFilter(nextValue)
            }}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
          >
            <option value="">Any browser-session state</option>
            <option value="none">No simulated decision</option>
            <option value="approve">Approved in demo</option>
            <option value="ask_for_coverage">
              Ask for coverage in demo
            </option>
            <option value="defer">Deferred in demo</option>
          </select>
          <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Session only. Refresh clears this filter and all simulated
            decisions.
          </p>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        Queue results updated. {requestCountLabel}
      </div>

      {visibleRows.length === 0 ? (
        decisionFilter && rows.length > 0 ? (
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
              <button
                type="button"
                onClick={clearDecisionFilter}
                className="text-left text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
              >
                Clear the demo decision filter
              </button>
              <ResetQueueFiltersLink
                href={clearAllHref}
                className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
              >
                Clear filters and show the full queue
              </ResetQueueFiltersLink>
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
              <ResetQueueFiltersLink
                href={clearAllHref}
                className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
              >
                Clear filters and show the full queue
              </ResetQueueFiltersLink>
            </div>
          </div>
        )
      ) : (
        <QueueResultsTable items={visibleRows} />
      )}
    </div>
  );
}
