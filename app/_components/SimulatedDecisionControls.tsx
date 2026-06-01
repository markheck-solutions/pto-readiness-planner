"use client";

import { useMemo, useState } from "react";

type Decision = "none" | "approve" | "defer" | "ask_for_coverage";

export function SimulatedDecisionControls() {
  const [decision, setDecision] = useState<Decision>("none");

  const decisionLabel = useMemo(() => {
    if (decision === "approve") return "Approve";
    if (decision === "defer") return "Defer";
    if (decision === "ask_for_coverage") return "Ask for coverage";
    return null;
  }, [decision]);

  return (
    <section aria-label="Simulated decision controls">
      {decisionLabel ? (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
          <span className="font-medium text-zinc-950 dark:text-zinc-50">
            Simulated decision:
          </span>{" "}
          {decisionLabel}. Refreshing the page resets this.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setDecision("approve")}
          className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Approve (demo)
        </button>
        <button
          type="button"
          onClick={() => setDecision("ask_for_coverage")}
          className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Ask for coverage (demo)
        </button>
        <button
          type="button"
          onClick={() => setDecision("defer")}
          className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Defer (demo)
        </button>
        <button
          type="button"
          onClick={() => setDecision("none")}
          className="ml-auto inline-flex items-center justify-center rounded-full px-3 py-2 text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
