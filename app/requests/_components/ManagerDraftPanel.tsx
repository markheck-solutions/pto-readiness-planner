"use client";

import { useMemo, useState } from "react";

import type { DemoRecommendation } from "../../../src/demo/dataset";
import type {
  ManagerDraftAction,
  ManagerDraftWarning,
} from "../../../src/domain/managerDraft/types";
import type {
  DemoDecision,
  SimulationDraftContext,
} from "../../../src/domain/simulation";

type DraftState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "loaded";
      action: ManagerDraftAction;
      draft: string;
      warnings: ManagerDraftWarning[];
    }
  | { status: "error"; message: string };

type DraftResponse = {
  action: ManagerDraftAction;
  draft: string;
  meta: {
    warnings?: ManagerDraftWarning[];
  };
};

function resolveDraftAction(
  decision: DemoDecision,
  recommendation: DemoRecommendation,
): ManagerDraftAction | null {
  if (decision === "approve") {
    return recommendation === "approve_with_coverage_actions"
      ? "approve_with_coverage_actions"
      : "approve";
  }
  if (decision === "defer") return "defer";
  if (decision === "ask_for_coverage") return "ask_for_coverage";
  return null;
}

function draftButtonLabel(action: ManagerDraftAction | null): string {
  if (action === "approve") return "Generate approval draft";
  if (action === "approve_with_coverage_actions")
    return "Generate conditional approval draft";
  if (action === "ask_for_coverage") return "Generate coverage follow-up draft";
  if (action === "defer") return "Generate defer draft";
  return "Generate draft";
}

function draftSummary(action: ManagerDraftAction | null): string {
  if (action === null) {
    return "Stage a demo action to generate a response draft.";
  }

  if (action === "approve") {
    return "Generate a practical approval draft tied to the current request facts.";
  }

  if (action === "approve_with_coverage_actions") {
    return "Generate an approval draft that includes the visible coverage follow-up actions.";
  }

  if (action === "ask_for_coverage") {
    return "Generate a focused follow-up asking for specific coverage confirmation.";
  }

  return "Generate a defer draft that explains the active coverage risk.";
}

function warningMessage(warnings: ManagerDraftWarning[]): string | null {
  if (warnings.length === 0) return null;
  return "The preview used the safe mock fallback for this request.";
}

export function ManagerDraftPanel({
  requestId,
  decision,
  recommendation,
  draftContext,
}: {
  requestId: string;
  decision: DemoDecision;
  recommendation: DemoRecommendation;
  draftContext: SimulationDraftContext;
}) {
  const draftAction = useMemo(
    () => resolveDraftAction(decision, recommendation),
    [decision, recommendation],
  );
  const activeStateKey = `${requestId}:${draftAction ?? "none"}`;
  const [stateSnapshot, setStateSnapshot] = useState<{
    key: string;
    state: DraftState;
  }>({
    key: activeStateKey,
    state: { status: "idle" },
  });
  const state =
    stateSnapshot.key === activeStateKey
      ? stateSnapshot.state
      : ({ status: "idle" } as DraftState);

  const buttonLabel = draftButtonLabel(draftAction);
  const helperSummary = draftSummary(draftAction);
  const fallbackMessage =
    state.status === "loaded" ? warningMessage(state.warnings) : null;

  const generateDraft = async () => {
    if (!draftAction) return;

    setStateSnapshot({
      key: activeStateKey,
      state: { status: "loading" },
    });
    try {
      const response = await fetch("/api/manager-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId,
          action: draftAction,
        }),
      });

      const json = (await response.json()) as DraftResponse & {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(json.error?.message ?? "Draft could not be generated.");
      }

      setStateSnapshot({
        key: activeStateKey,
        state: {
          status: "loaded",
          action: json.action,
          draft: json.draft,
          warnings: json.meta.warnings ?? [],
        },
      });
    } catch (error) {
      setStateSnapshot({
        key: activeStateKey,
        state: {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Draft could not be generated right now.",
        },
      });
    }
  };

  return (
    <section
      aria-label="Manager response draft context"
      aria-live="polite"
      aria-busy={state.status === "loading"}
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Manager response draft context
          </div>
          <h4 className="mt-1 text-base font-semibold text-zinc-950 dark:text-zinc-50">
            {draftContext.title}
          </h4>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {draftContext.summary}
      </p>

      <ul className="mt-4 space-y-2">
        {draftContext.callouts.map((callout) => (
          <li
            key={callout}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300"
          >
            {callout}
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-white px-3 py-3 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/10 dark:text-zinc-400">
        {helperSummary}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generateDraft}
          disabled={!draftAction || state.status === "loading"}
          className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {state.status === "loading" ? "Generating draft..." : buttonLabel}
        </button>

        {state.status === "idle" ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            No message is generated, sent, or saved.
          </span>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300">
          Generating draft preview...
        </div>
      ) : null}

      {state.status === "loaded" ? (
        <div className="mt-4 space-y-3">
          {fallbackMessage ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
              {fallbackMessage}
            </div>
          ) : null}

          <article
            aria-label="Generated manager response draft"
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-7 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-200"
          >
            {state.draft}
          </article>

          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/10 dark:text-zinc-400">
            Generated draft previews remain session-only. Nothing is sent or
            saved.
          </div>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100">
          <p>Draft preview is temporarily unavailable.</p>
          <p className="mt-1 text-xs text-red-800 dark:text-red-200">
            {state.message}
          </p>
        </div>
      ) : null}
    </section>
  );
}
