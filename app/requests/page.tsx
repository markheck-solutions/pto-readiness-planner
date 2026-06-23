import Link from "next/link";

import { DemoNotice } from "../_components/DemoNotice";
import { QueueControlsForm } from "./QueueControlsForm";
import { QueueResultsPanel } from "./QueueResultsPanel";
import { buildQueuePageModel, type QueuePageModel } from "./queuePageModel";

import { parseIsoDate, type IsoDate } from "../../src/domain/dates";
import {
  buildReviewHref,
  readReviewFilterQuery,
} from "../../src/domain/reviewFilters";
import { getDemoRepo, type DemoRepo } from "../../src/repos/demoRepo";

type SearchParams = Record<string, string | string[] | undefined>;

function formatShortDay(iso: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(iso));
}

function RequestsHeader() {
  return (
    <div className="max-w-3xl">
      <div className="text-xs text-zinc-600 dark:text-zinc-400">
        <Link
          href="/"
          className="underline underline-offset-4 hover:text-zinc-950 dark:hover:text-zinc-50"
        >
          Manager overview
        </Link>{" "}
        <span aria-hidden="true">/</span> PTO request queue
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
        PTO request queue
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        Filter and sort requests to focus manager time on coverage readiness.
        This is a public demo with fictional data only. Actions are simulation
        only and reset on refresh.
      </p>
    </div>
  );
}

function ReviewContextPanel({ model }: { model: QueuePageModel }) {
  if (!model.heatmapWeekStart) return null;

  return (
    <section
      aria-label="Review context"
      className="mt-6 rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
    >
      <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Review context
      </div>
      <p className="mt-2 leading-6">
        Started from the selected heatmap week of{" "}
        <span className="font-semibold text-zinc-950 dark:text-zinc-50">
          {formatShortDay(model.heatmapWeekStart)}
        </span>
        . Queue filters and detail links keep that route context available while
        you review this window.
      </p>
      <div className="mt-3">
        <Link
          href={buildReviewHref("/heatmap", model.baseQuery)}
          className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
        >
          Return to selected heatmap week
        </Link>
      </div>
    </section>
  );
}

function RequestsPageView({
  repo,
  model,
}: {
  repo: DemoRepo;
  model: QueuePageModel;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <RequestsHeader />

      <div className="mt-6">
        <DemoNotice compact />
      </div>

      <ReviewContextPanel model={model} />

      <section aria-label="Queue controls" className="mt-8">
        <QueueControlsForm repo={repo} model={model} />
      </section>

      <section aria-label="Queue results" className="mt-6">
        <QueueResultsPanel rows={model.rows} clearAllHref="/requests" />
      </section>
    </div>
  );
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const repo = getDemoRepo();
  const sp = await Promise.resolve(searchParams ?? {});
  const model = buildQueuePageModel(repo, readReviewFilterQuery(sp));

  return <RequestsPageView repo={repo} model={model} />;
}
