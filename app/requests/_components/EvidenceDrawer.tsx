"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { RiskBadge } from "../../_components/StatusBadges";

import type { EvidenceItem } from "../../../src/domain/evidence/evidenceBuilder";
import { parseIsoDate, type IsoDate } from "../../../src/domain/dates";

type DrawerState = "idle" | "loading" | "loaded" | "empty" | "error";

function formatDate(value: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(value));
}

function humanizeSourceType(sourceType: EvidenceItem["sourceType"]): string {
  return sourceType
    .split("_")
    .map((part, index) =>
      index === 0
        ? part.charAt(0).toUpperCase() + part.slice(1)
        : part.toLowerCase(),
    )
    .join(" ");
}

function focusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled"));
}

export function EvidenceDrawer({
  open,
  requestId,
  reasonSummary,
  evidenceIds,
  onClose,
}: {
  open: boolean;
  requestId: string;
  reasonSummary: string | null;
  evidenceIds: string[];
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [state, setState] = useState<DrawerState>(() =>
    evidenceIds.length === 0 ? "empty" : "loading",
  );
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const evidenceKey = useMemo(() => evidenceIds.join("|"), [evidenceIds]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const openedAt = Date.now();
    const ensureLoadingVisible = async () => {
      const elapsed = Date.now() - openedAt;
      if (elapsed < 120) {
        await new Promise((resolve) => setTimeout(resolve, 120 - elapsed));
      }
    };

    if (evidenceIds.length > 0) {
      const loadEvidence = async () => {
        try {
          const response = await fetch(
            `/api/evidence?ids=${encodeURIComponent(evidenceIds.join(","))}`,
            {
              signal: controller.signal,
            },
          );
          const json = (await response.json()) as {
            items?: EvidenceItem[];
            error?: { message?: string };
          };

          if (!response.ok) {
            throw new Error(json.error?.message ?? "Evidence failed to load.");
          }

          const nextItems = Array.isArray(json.items) ? json.items : [];
          await ensureLoadingVisible();
          setItems(nextItems);
          setState(nextItems.length > 0 ? "loaded" : "empty");
        } catch (error) {
          if (controller.signal.aborted) return;
          await ensureLoadingVisible();
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Evidence could not be loaded right now.",
          );
          setState("error");
        }
      };

      loadEvidence();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusables = focusableElements(panelRef.current);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      controller.abort();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [evidenceKey, evidenceIds, onClose, open, requestId, retryToken]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const hiddenSurfaces = Array.from(
      document.querySelectorAll<HTMLElement>("header, main, footer"),
    );

    for (const surface of hiddenSurfaces) {
      surface.setAttribute(
        "data-evidence-drawer-prev-aria-hidden",
        surface.getAttribute("aria-hidden") ?? "",
      );
      surface.setAttribute("aria-hidden", "true");
      surface.setAttribute("inert", "");
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      for (const surface of hiddenSurfaces) {
        const previous = surface.getAttribute(
          "data-evidence-drawer-prev-aria-hidden",
        );
        if (previous === "") {
          surface.removeAttribute("aria-hidden");
        } else if (previous !== null) {
          surface.setAttribute("aria-hidden", previous);
        }
        surface.removeAttribute("data-evidence-drawer-prev-aria-hidden");
        surface.removeAttribute("inert");
      }
    };
  }, [open]);

  if (!open) return null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-zinc-950/50">
      <div
        aria-hidden="true"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <aside
        id="evidence-drawer-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-drawer-title"
        aria-describedby="evidence-drawer-description"
        aria-busy={state === "loading"}
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Recommendation evidence
            </p>
            <h2
              id="evidence-drawer-title"
              className="mt-1 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
            >
              Evidence drawer
            </h2>
            <p
              id="evidence-drawer-description"
              className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
            >
              {reasonSummary ?? "No reason selected."}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            Close evidence drawer
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Request context
          </div>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            Request {requestId}. This drawer only shows seeded demo facts and
            closes without saving anything.
          </p>

          {state === "loading" ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
            >
              Loading seeded evidence...
            </div>
          ) : null}

          {state === "empty" ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
            >
              No seeded evidence was found for this reason.
            </div>
          ) : null}

          {state === "error" ? (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100"
            >
              <p>Evidence could not be loaded right now.</p>
              <p className="mt-1 text-xs text-red-800 dark:text-red-200">
                {errorMessage ?? "Try loading the drawer again."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setItems([]);
                  setState("loading");
                  setRetryToken((value) => value + 1);
                }}
                className="mt-3 inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100 dark:hover:bg-red-900/30"
              >
                Retry
              </button>
            </div>
          ) : null}

          {state === "loaded" ? (
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {humanizeSourceType(item.sourceType)}
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {item.title}
                      </h3>
                    </div>
                    <RiskBadge band={item.severity} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                    {item.explanation}
                  </p>
                  <dl className="mt-3 grid gap-2 text-xs text-zinc-600 dark:text-zinc-400 sm:grid-cols-2">
                    {item.dateRange ? (
                      <div>
                        <dt className="font-medium">Date range</dt>
                        <dd>
                          {formatDate(item.dateRange.start)} to{" "}
                          {formatDate(item.dateRange.end)}
                        </dd>
                      </div>
                    ) : null}
                    {item.teamId ? (
                      <div>
                        <dt className="font-medium">Team</dt>
                        <dd>{item.teamId}</dd>
                      </div>
                    ) : null}
                    {item.roleId ? (
                      <div>
                        <dt className="font-medium">Role</dt>
                        <dd>{item.roleId}</dd>
                      </div>
                    ) : null}
                    <div className="sm:col-span-2">
                      <dt className="font-medium">Related seeded facts</dt>
                      <dd className="mt-1 flex flex-wrap gap-2">
                        {Object.entries(item.relatedIds).map(([key, value]) => (
                          <span
                            key={`${item.id}-${key}`}
                            className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300"
                          >
                            {key}: {value}
                          </span>
                        ))}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
