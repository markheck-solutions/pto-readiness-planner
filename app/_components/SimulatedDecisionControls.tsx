"use client";

import { useBrowserDecision } from "./BrowserDecisionProvider";

import { decisionActionLabel } from "../../src/domain/simulation";

export function SimulatedDecisionControls({
  requestId,
}: {
  requestId: string;
}) {
  const { decision, setDecision, clearDecision } =
    useBrowserDecision(requestId);
  const bannerLabel = decisionActionLabel(decision);

  return (
    <section aria-label="Simulated decision controls">
      {bannerLabel ? (
        <div
          className="mb-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
          aria-live="polite"
        >
          <span className="font-medium text-zinc-950 dark:text-zinc-50">
            Simulated decision:
          </span>{" "}
          {bannerLabel}. Queue badges, demo filters, and draft context update in
          this browser session only. Refresh resets it.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setDecision(requestId, "approve")}
          aria-pressed={decision === "approve"}
          className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Approve (demo)
        </button>
        <button
          type="button"
          onClick={() => setDecision(requestId, "ask_for_coverage")}
          aria-pressed={decision === "ask_for_coverage"}
          className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Ask for coverage (demo)
        </button>
        <button
          type="button"
          onClick={() => setDecision(requestId, "defer")}
          aria-pressed={decision === "defer"}
          className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Defer (demo)
        </button>
        <button
          type="button"
          onClick={() => clearDecision(requestId)}
          className="ml-auto inline-flex items-center justify-center rounded-full px-3 py-2 text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Reset demo state
        </button>
      </div>
    </section>
  );
}
