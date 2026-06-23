import Link from "next/link";

import { DemoNotice } from "../../_components/DemoNotice";
import {
  LoadingStateSkeleton,
  SafeStatePanel,
} from "../../_components/SafeStatePanel";
import { RequestDetailClient } from "../_components/RequestDetailClient";
import {
  buildRequestDetailPageModel,
  type DetailPreviewState,
  type LoadedRequestDetail,
  type RequestDetailPageModel,
  type RequestReviewContext,
} from "./detailPageModel";

import { parseIsoDate, type IsoDate } from "../../../src/domain/dates";
import { getDemoRepo } from "../../../src/repos/demoRepo";

type SearchParams = Record<string, string | string[] | undefined>;

function formatShortDay(iso: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(iso));
}

function RequestDetailHeader({
  queueHref,
  title,
}: {
  queueHref: string;
  title: string;
}) {
  return (
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
          {title}
        </h1>
      </div>
    </div>
  );
}

function ReviewContextPanel({
  context,
  queueHref,
}: {
  context: RequestReviewContext | null;
  queueHref: string;
}) {
  if (!context) return null;

  return (
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
          {formatShortDay(context.weekStart)} to{" "}
          {formatShortDay(context.weekEnd)}
        </span>
        . Queue filters, detail review, and evidence stay aligned to this public
        demo window.
      </p>
      <div className="mt-3 flex flex-wrap gap-4">
        <Link
          href={context.heatmapHref}
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
  );
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

function MissingRequestPanel({ queueHref }: { queueHref: string }) {
  return (
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
  );
}

function LoadedDetail({ detail }: { detail: LoadedRequestDetail }) {
  return (
    <RequestDetailClient
      key={detail.request.id}
      request={detail.request}
      employee={detail.employee}
      team={detail.team}
      role={detail.role}
      assessment={detail.assessment}
      backupOptions={detail.backupOptions}
    />
  );
}

function RequestDetailBody({ model }: { model: RequestDetailPageModel }) {
  if (model.previewState) {
    return (
      <div className="mt-8">
        <RequestDetailStatePreview
          state={model.previewState}
          requestId={model.requestId}
          queueHref={model.queueHref}
        />
      </div>
    );
  }

  if (model.detail) return <LoadedDetail detail={model.detail} />;
  return <MissingRequestPanel queueHref={model.queueHref} />;
}

function RequestDetailPageView({ model }: { model: RequestDetailPageModel }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <RequestDetailHeader
        queueHref={model.queueHref}
        title={model.detail?.request.id ?? model.requestId}
      />

      <div className="mt-6">
        <DemoNotice compact />
      </div>

      <ReviewContextPanel
        context={model.reviewContext}
        queueHref={model.queueHref}
      />
      <RequestDetailBody model={model} />
    </div>
  );
}

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: { requestId: string } | Promise<{ requestId: string }>;
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const repo = getDemoRepo();
  const { requestId } = await Promise.resolve(params);
  const sp = await Promise.resolve(searchParams ?? {});
  const model = buildRequestDetailPageModel(repo, requestId, sp);

  return <RequestDetailPageView model={model} />;
}
