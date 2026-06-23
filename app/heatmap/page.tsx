import Link from "next/link";

import { DemoNotice } from "../_components/DemoNotice";
import {
  LoadingStateSkeleton,
  SafeStatePanel,
} from "../_components/SafeStatePanel";
import { CoverageBadge, RiskBadge } from "../_components/StatusBadges";
import {
  bandLabel,
  buildHeatmapPageModel,
  requestDetailHref,
  requestRangeHref,
  weekRangeHref,
  type HeatmapPageModel,
  type HeatmapPreviewState,
  type HeatmapWeek,
  type SelectedHeatmapWeek,
} from "./heatmapPageModel";

import { parseIsoDate, type IsoDate } from "../../src/domain/dates";
import {
  buildReviewHref,
  withDefaultQueueSort,
  withoutSelectedWeekRange,
} from "../../src/domain/reviewFilters";
import { getDemoRepo } from "../../src/repos/demoRepo";

type SearchParams = Record<string, string | string[] | undefined>;

function formatShortDay(iso: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(iso));
}

function HeatmapHeader() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
        Coverage heatmap
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        A manager-friendly snapshot of upcoming coverage pressure. Select a week
        to inspect pressure reasons, coverage matrix rows, and matching request
        context.
      </p>
    </div>
  );
}

function HeatmapStatePreview({
  state,
  liveHref,
  queueHref,
}: {
  state: HeatmapPreviewState;
  liveHref: string;
  queueHref: string;
}) {
  if (state === "loading") {
    return (
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SafeStatePanel
          label="Heatmap loading preview"
          title="Loading the coverage heatmap"
          description="The selected coverage window is still loading. Final week bands stay hidden until the heatmap is ready, which avoids mixing live cells with placeholder data."
          tone="info"
          role="status"
          ariaLive="polite"
          actions={[
            { href: liveHref, label: "Return to the live heatmap" },
            {
              href: queueHref,
              label: "Open PTO request queue",
              variant: "secondary",
            },
          ]}
        >
          <LoadingStateSkeleton cards={4} className="lg:grid-cols-2" />
        </SafeStatePanel>

        <SafeStatePanel
          label="Coverage matrix loading preview"
          title="Preparing the role coverage matrix"
          description="Required and available coverage counts are still being assembled for the selected week."
          tone="info"
          role="status"
          ariaLive="polite"
          actions={[
            { href: liveHref, label: "Return to the live heatmap" },
            {
              href: queueHref,
              label: "Review the queue while this loads",
              variant: "secondary",
            },
          ]}
        >
          <LoadingStateSkeleton cards={3} className="lg:grid-cols-1" />
        </SafeStatePanel>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SafeStatePanel
          label="Heatmap empty-state preview"
          title="No coverage windows match this view"
          description="There are no seeded coverage periods to plot for the current filter or preview. Managers can reset to the live range or jump straight to the full queue."
          tone="neutral"
          actions={[
            { href: liveHref, label: "Return to the live heatmap" },
            {
              href: queueHref,
              label: "Open the full queue",
              variant: "secondary",
            },
          ]}
          bullets={[
            "The empty state keeps the page informative instead of leaving a blank grid.",
            "No stale week badges or pressure reasons remain on screen while this state is active.",
          ]}
        />

        <SafeStatePanel
          label="Coverage matrix empty-state preview"
          title="No coverage rows are available for this selection"
          description="Pick a live week again to restore role-by-role required and available coverage counts."
          tone="neutral"
          actions={[
            { href: liveHref, label: "Reload a live week" },
            {
              href: queueHref,
              label: "Review queue priorities",
              variant: "secondary",
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <SafeStatePanel
        label="Heatmap error preview"
        title="Heatmap data is temporarily unavailable"
        description="The coverage map could not be refreshed right now. Retry the live heatmap or use another safe route while this surface recovers."
        tone="danger"
        role="alert"
        ariaLive="assertive"
        actions={[
          { href: liveHref, label: "Retry the live heatmap" },
          {
            href: queueHref,
            label: "Open PTO request queue",
            variant: "secondary",
          },
        ]}
      />

      <SafeStatePanel
        label="Coverage matrix error preview"
        title="Coverage matrix is temporarily unavailable"
        description="Required versus available role coverage could not be shown for this selection, so final counts remain hidden until the live view is available again."
        tone="danger"
        role="alert"
        ariaLive="assertive"
        actions={[
          { href: liveHref, label: "Retry the live heatmap" },
          {
            href: "/",
            label: "Return to manager overview",
            variant: "secondary",
          },
        ]}
      />
    </div>
  );
}

function SelectionNotice({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100"
    >
      {message}
    </div>
  );
}

function HeatmapLegend() {
  return (
    <section aria-label="Heatmap legend" className="mt-8">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Legend
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <RiskBadge band="healthy" />
          <RiskBadge band="thin" />
          <RiskBadge band="risky" />
          <RiskBadge band="critical" />
        </div>
        <p className="mt-3 leading-6">
          Healthy means coverage stays above minimum. Thin means a role sits at
          minimum. Risky means coverage drops below minimum. Critical means
          single-person exposure or a blackout-style window.
        </p>
      </div>
    </section>
  );
}

function PressureReasons({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) {
    return <p className="mt-1">No elevated pressure signals in this week.</p>;
  }

  return (
    <ul className="mt-1 list-disc space-y-1 pl-5">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}

function WeekCard({
  week,
  selectedWeekStart,
  model,
}: {
  week: HeatmapWeek;
  selectedWeekStart: IsoDate;
  model: HeatmapPageModel;
}) {
  const selected = week.weekStart === selectedWeekStart;

  return (
    <Link
      href={weekRangeHref(model.reviewQuery, week.weekStart, week.weekEnd)}
      aria-current={selected ? "page" : undefined}
      aria-label={[
        `Week of ${formatShortDay(week.weekStart)}.`,
        `${bandLabel(week.worstBand)} coverage.`,
        week.reasons.length > 0
          ? `Pressure reasons: ${week.reasons.join("; ")}.`
          : "No elevated pressure signals in this week.",
      ].join(" ")}
      className={[
        "rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:bg-zinc-900/40",
        selected
          ? "border-zinc-950 ring-2 ring-zinc-950 dark:border-zinc-50 dark:ring-zinc-50"
          : "border-zinc-200 dark:border-zinc-800",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Week of {formatShortDay(week.weekStart)}
        </div>
        <RiskBadge band={week.worstBand} />
      </div>
      <div className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Pressure reasons
        </div>
        <PressureReasons reasons={week.reasons} />
        <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
          Range: {week.weekStart} to {week.weekEnd}
        </div>
      </div>
    </Link>
  );
}

function HeatmapGrid({
  model,
  selected,
}: {
  model: HeatmapPageModel;
  selected: SelectedHeatmapWeek;
}) {
  return (
    <section aria-label="Heatmap grid" className="mt-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {model.weeks.map((week) => (
          <WeekCard
            key={week.weekStart}
            week={week}
            selectedWeekStart={selected.weekStart}
            model={model}
          />
        ))}
      </div>
    </section>
  );
}

function MatchingRequestsList({
  selected,
  model,
}: {
  selected: SelectedHeatmapWeek;
  model: HeatmapPageModel;
}) {
  if (selected.queueItems.length === 0) {
    return (
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        No requests overlap this selected week in the demo set.
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-3">
      {selected.queueItems.slice(0, 3).map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/20"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={requestDetailHref(
                model.reviewQuery,
                item.id,
                selected.weekStart,
                selected.weekEnd,
              )}
              className="text-sm font-semibold text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
            >
              {item.employee.displayName} ({item.id})
            </Link>
            <RiskBadge
              band={item.assessment.band}
              score={item.assessment.score}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">{item.team.name}</span>
            <span
              className="text-zinc-500 dark:text-zinc-400"
              aria-hidden="true"
            >
              ·
            </span>
            <span>{item.role.name}</span>
            <span
              className="text-zinc-500 dark:text-zinc-400"
              aria-hidden="true"
            >
              ·
            </span>
            <span>{item.assessment.topReason.summary}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SelectedWeekPanel({
  selected,
  model,
}: {
  selected: SelectedHeatmapWeek;
  model: HeatmapPageModel;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Selected week
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {formatShortDay(selected.weekStart)} to{" "}
            {formatShortDay(selected.weekEnd)}
          </p>
        </div>
        <RiskBadge band={selected.band} />
      </div>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Pressure reasons
        </div>
        <PressureReasons reasons={selected.reasons} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={requestRangeHref(
            model.reviewQuery,
            selected.weekStart,
            selected.weekEnd,
          )}
          className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Open queue for this window
        </Link>
        <Link
          href={buildReviewHref(
            "/requests",
            withDefaultQueueSort(withoutSelectedWeekRange(model.reviewQuery)),
          )}
          className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Open the full queue
        </Link>
      </div>

      <div className="mt-6">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Matching requests in this week
        </div>
        <MatchingRequestsList selected={selected} model={model} />
      </div>
    </div>
  );
}

function coverageStatusText(row: SelectedHeatmapWeek["coverageRows"][number]) {
  if (row.singlePersonExposure) return "Single-person role exposure";
  if (row.comparison === "below") return "Below required coverage";
  if (row.comparison === "exact") return "At the minimum";
  return "Above required coverage";
}

function CoverageMatrixSection({
  selected,
}: {
  selected: SelectedHeatmapWeek;
}) {
  return (
    <section
      aria-label="Coverage matrix"
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Coverage matrix
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            Required versus available coverage for the selected week.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table
          className="w-full border-collapse text-left text-sm"
          aria-describedby="coverage-matrix-summary"
        >
          <caption className="sr-only">
            Coverage matrix for the selected week
          </caption>
          <thead className="bg-zinc-50 text-xs text-zinc-600 dark:bg-zinc-950/40 dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Team
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Role
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Required
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Available
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {selected.coverageRows.map((row) => (
              <tr key={`${row.teamId}-${row.roleId}`} className="align-top">
                <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                  {row.teamName}
                </td>
                <th
                  scope="row"
                  className="px-3 py-3 text-left text-zinc-700 dark:text-zinc-300"
                >
                  <div className="font-medium text-zinc-950 dark:text-zinc-50">
                    {row.roleName}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatShortDay(selected.weekStart)} to{" "}
                    {formatShortDay(selected.weekEnd)}
                  </div>
                </th>
                <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                  <span className="font-mono tabular-nums">{row.required}</span>
                </td>
                <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                  <span className="font-mono tabular-nums">
                    {row.minAvailable}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <CoverageBadge
                    comparison={row.comparison}
                    singlePersonExposure={row.singlePersonExposure}
                    available={row.minAvailable}
                    required={row.required}
                  />
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {coverageStatusText(row)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p
        id="coverage-matrix-summary"
        className="mt-3 text-xs text-zinc-500 dark:text-zinc-400"
      >
        Coverage matrix rows compare required and available staffing for the
        selected week, including above minimum, at minimum, below minimum, and
        single-person exposure states.
      </p>
    </section>
  );
}

function LiveHeatmapView({ model }: { model: HeatmapPageModel }) {
  const selected = model.selected;
  if (!selected) return null;

  return (
    <>
      <SelectionNotice message={model.selectionNotice} />
      <HeatmapLegend />
      <HeatmapGrid model={model} selected={selected} />
      <section
        aria-label="Selected week"
        className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
      >
        <SelectedWeekPanel selected={selected} model={model} />
        <CoverageMatrixSection selected={selected} />
      </section>
    </>
  );
}

function HeatmapView({ model }: { model: HeatmapPageModel }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <HeatmapHeader />

      <div className="mt-6">
        <DemoNotice compact />
      </div>

      {model.previewState ? (
        <HeatmapStatePreview
          state={model.previewState}
          liveHref={model.liveHref}
          queueHref={model.queueHref}
        />
      ) : (
        <LiveHeatmapView model={model} />
      )}
    </div>
  );
}

export default async function HeatmapPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const repo = getDemoRepo();
  const sp = await Promise.resolve(searchParams ?? {});
  const model = buildHeatmapPageModel(repo, sp);

  return <HeatmapView model={model} />;
}
