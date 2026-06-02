import Link from "next/link";

import { DemoNotice } from "../../_components/DemoNotice";
import {
  LoadingStateSkeleton,
  SafeStatePanel,
} from "../../_components/SafeStatePanel";

import {
  isIsoDate,
  parseIsoDate,
  type IsoDate,
} from "../../../src/domain/dates";
import { createAssessmentForRequest } from "../../../src/domain/assessment/createRequestAssessment";
import {
  buildReviewHref,
  readReviewFilterQuery,
  withWeekStartFromDateRange,
  type ReviewFilterQuery,
} from "../../../src/domain/reviewFilters";
import {
  findEmployeeById,
  findPtoRequestById,
  findRoleById,
  findTeamById,
  getDemoRepo,
} from "../../../src/repos/demoRepo";
import { RequestDetailClient } from "../_components/RequestDetailClient";

type SearchParams = Record<string, string | string[] | undefined>;
type DetailPreviewState = "no-selection" | "loading" | "error";

function asString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function overlaps(
  a: { start: IsoDate; end: IsoDate },
  b: { start: IsoDate; end: IsoDate },
): boolean {
  return !(a.end < b.start || b.end < a.start);
}

function employeeAvailableForRange(
  repo: ReturnType<typeof getDemoRepo>,
  employeeId: string,
  range: { start: IsoDate; end: IsoDate },
): boolean {
  for (const absence of repo.existingAbsences) {
    if (absence.employeeId !== employeeId) continue;
    if (overlaps(range, { start: absence.startDate, end: absence.endDate })) {
      return false;
    }
  }

  for (const request of repo.ptoRequests) {
    if (request.employeeId !== employeeId) continue;
    if (request.status === "withdrawn") continue;
    if (
      overlaps(range, {
        start: request.requestedStartDate,
        end: request.requestedEndDate,
      })
    ) {
      return false;
    }
  }

  return true;
}

function getDetailPreviewState(
  value: string | undefined,
): DetailPreviewState | null {
  if (value === "no-selection") return "no-selection";
  if (value === "loading") return "loading";
  if (value === "error") return "error";
  return null;
}

function buildQueueHref(query: ReviewFilterQuery): string {
  return buildReviewHref("/requests", query);
}

function buildHeatmapHref(query: ReviewFilterQuery): string | null {
  const weekQuery = withWeekStartFromDateRange(query);
  const weekStart = weekQuery.weekStart;
  if (!weekStart || !isIsoDate(weekStart)) return null;
  return buildReviewHref("/heatmap", weekQuery);
}

function formatShortDay(iso: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(iso));
}

function RequestDetailStatePreview({
  state,
  requestId,
  queueHref,
}: {
  state: DetailPreviewState;
  requestId: string;
  queueHref: string;
}) {
  const liveHref = `/requests/${requestId}`;

  if (state === "no-selection") {
    return (
      <SafeStatePanel
        label="Request detail no-selection preview"
        title="Choose a request to inspect coverage reasoning"
        description="This safe state shows the detail surface before a queue row is selected. Recommendation, fairness, evidence, and backup sections stay hidden until a request is opened."
        tone="neutral"
        actions={[
          { href: queueHref, label: "Open PTO request queue" },
          {
            href: liveHref,
            label: "Open a live request detail",
            variant: "secondary",
          },
        ]}
        bullets={[
          "Use the queue or the heatmap to choose the next request to review.",
          "No stale employee, score, or conflict details remain visible in this state.",
        ]}
      />
    );
  }

  if (state === "loading") {
    return (
      <SafeStatePanel
        label="Request detail loading preview"
        title="Loading request detail"
        description="The selected request is still loading. Final recommendation, conflict, and fairness content stays hidden until the full detail record is ready."
        tone="info"
        role="status"
        ariaLive="polite"
        actions={[
          { href: liveHref, label: "Return to the live request" },
          {
            href: queueHref,
            label: "Back to the queue",
            variant: "secondary",
          },
        ]}
      >
        <LoadingStateSkeleton cards={3} className="lg:grid-cols-1" />
      </SafeStatePanel>
    );
  }

  return (
    <SafeStatePanel
      label="Request detail error preview"
      title="Request detail is temporarily unavailable"
      description="The request detail could not be refreshed right now. Retry the live request or return to the queue while this surface recovers."
      tone="danger"
      role="alert"
      ariaLive="assertive"
      actions={[
        { href: liveHref, label: "Retry this request" },
        {
          href: queueHref,
          label: "Back to the queue",
          variant: "secondary",
        },
      ]}
      bullets={[
        "The fallback avoids raw errors, stack traces, and partial seeded details.",
        "Queue navigation stays available so managers do not reach a dead end.",
      ]}
    />
  );
}

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: { requestId: string } | Promise<{ requestId: string }>;
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const { requestId } = await Promise.resolve(params);
  const sp = await Promise.resolve(searchParams ?? {});
  const reviewQuery = readReviewFilterQuery(sp);
  const previewState = getDetailPreviewState(asString(sp.state));
  const queueHref = buildQueueHref(reviewQuery);
  const heatmapHref = buildHeatmapHref(reviewQuery);
  const weekStart = reviewQuery.weekStart;
  const weekEnd = reviewQuery.endDate;
  const hasHeatmapContext =
    heatmapHref !== null &&
    weekStart !== undefined &&
    weekEnd !== undefined &&
    isIsoDate(weekStart) &&
    isIsoDate(weekEnd);
  const reviewContext = hasHeatmapContext
    ? {
        heatmapHref,
        weekStart,
        weekEnd,
      }
    : null;

  if (previewState) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              <Link
                href={queueHref}
                className="underline underline-offset-4 hover:text-zinc-950 dark:hover:text-zinc-50"
              >
                PTO requests
              </Link>{" "}
              <span aria-hidden="true">/</span> Request detail
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
              Request detail
            </h1>
          </div>
        </div>

        <div className="mt-6">
          <DemoNotice compact />
        </div>

        {reviewContext ? (
          <section
            aria-label="Review context"
            className="mt-6 rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
          >
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Review context
            </div>
            <p className="mt-2 leading-6">
              Selected heatmap week:{" "}
              <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                {formatShortDay(reviewContext.weekStart)} to{" "}
                {formatShortDay(reviewContext.weekEnd)}
              </span>
              . Queue filters, detail review, and evidence stay aligned to this
              public demo window.
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <Link
                href={reviewContext.heatmapHref}
                className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
              >
                Return to selected heatmap week
              </Link>
              <Link
                href={queueHref}
                className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
              >
                Open queue for this review window
              </Link>
            </div>
          </section>
        ) : null}

        <div className="mt-8">
          <RequestDetailStatePreview
            state={previewState}
            requestId={requestId}
            queueHref={queueHref}
          />
        </div>
      </div>
    );
  }

  const repo = getDemoRepo();
  const req = findPtoRequestById(repo, requestId);

  const employee = req ? findEmployeeById(repo, req.employeeId) : null;
  const team = employee ? findTeamById(repo, employee.teamId) : null;
  const role = employee ? findRoleById(repo, employee.roleId) : null;

  const assessment =
    req && employee
      ? createAssessmentForRequest({
          repo,
          request: req,
          teamId: employee.teamId,
          roleId: employee.roleId,
        })
      : null;

  const backupOptions =
    req && employee && team && role
      ? repo.employees
          .filter((candidate) => candidate.teamId === team.id)
          .filter((candidate) => candidate.roleId === role.id)
          .filter((candidate) => candidate.id !== employee.id)
          .map((candidate) => {
            const available = employeeAvailableForRange(repo, candidate.id, {
              start: req.requestedStartDate,
              end: req.requestedEndDate,
            });

            return {
              id: candidate.id,
              displayName: candidate.displayName,
              available,
              note: available
                ? "Available for the selected window."
                : "Already booked or absent during part of the selected window.",
            };
          })
          .sort((a, b) => {
            if (a.available !== b.available) return a.available ? -1 : 1;
            return a.displayName < b.displayName ? -1 : 1;
          })
      : [];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            <Link
              href={queueHref}
              className="underline underline-offset-4 hover:text-zinc-950 dark:hover:text-zinc-50"
            >
              PTO requests
            </Link>{" "}
            <span aria-hidden="true">/</span> Request detail
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
            {req ? req.id : requestId}
          </h1>
        </div>
      </div>

      <div className="mt-6">
        <DemoNotice compact />
      </div>

      {reviewContext ? (
        <section
          aria-label="Review context"
          className="mt-6 rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
        >
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Review context
          </div>
          <p className="mt-2 leading-6">
            Selected heatmap week:{" "}
            <span className="font-semibold text-zinc-950 dark:text-zinc-50">
              {formatShortDay(reviewContext.weekStart)} to{" "}
              {formatShortDay(reviewContext.weekEnd)}
            </span>
            . Queue filters, detail review, and evidence stay aligned to this
            public demo window.
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <Link
              href={reviewContext.heatmapHref}
              className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
            >
              Return to selected heatmap week
            </Link>
            <Link
              href={queueHref}
              className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
            >
              Open queue for this review window
            </Link>
          </div>
        </section>
      ) : null}

      {req && employee && team && role && assessment ? (
        <RequestDetailClient
          key={req.id}
          request={req}
          employee={employee}
          team={team}
          role={role}
          assessment={assessment}
          backupOptions={backupOptions}
        />
      ) : (
        <section
          aria-label="Missing request"
          className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
        >
          <p className="font-medium text-zinc-950 dark:text-zinc-50">
            This request ID is not part of the demo dataset.
          </p>
          <p className="mt-2">
            Go back to the{" "}
            <Link
              href={queueHref}
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
