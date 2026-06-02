import Link from "next/link";

import { DemoNotice } from "../_components/DemoNotice";
import {
  LoadingStateSkeleton,
  SafeStatePanel,
} from "../_components/SafeStatePanel";
import { CoverageBadge, RiskBadge } from "../_components/StatusBadges";

import type { DemoCoverageBand } from "../../src/demo/dataset";
import {
  addDaysIsoDate,
  eachDayInclusive,
  isIsoDate,
  parseIsoDate,
  type IsoDate,
} from "../../src/domain/dates";
import { buildCalendarHeatmap } from "../../src/domain/heatmap/heatmapBuilder";
import { buildCoverageMatrix } from "../../src/domain/coverage/coverageMatrix";
import { buildQueue } from "../../src/domain/ptoQueue/queueService";
import { getDemoRepo } from "../../src/repos/demoRepo";

type SearchParams = Record<string, string | string[] | undefined>;
type HeatmapPreviewState = "loading" | "empty" | "error";

function asString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function formatShortDay(iso: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(iso));
}

function bandRank(band: DemoCoverageBand): number {
  if (band === "critical") return 3;
  if (band === "risky") return 2;
  if (band === "thin") return 1;
  return 0;
}

function weekRangeHref(weekStart: IsoDate): string {
  const params = new URLSearchParams();
  params.set("weekStart", weekStart);
  return `/heatmap?${params.toString()}`;
}

function requestRangeHref(startDate: IsoDate, endDate: IsoDate): string {
  const params = new URLSearchParams();
  params.set("startDate", startDate);
  params.set("endDate", endDate);
  params.set("status", "pending");
  params.set("sort", "risk");
  params.set("dir", "desc");
  return `/requests?${params.toString()}`;
}

function getHeatmapPreviewState(
  value: string | undefined,
): HeatmapPreviewState | null {
  if (value === "loading") return "loading";
  if (value === "empty") return "empty";
  if (value === "error") return "error";
  return null;
}

function liveHeatmapHref(weekStart: string | undefined): string {
  if (weekStart && isIsoDate(weekStart)) {
    const params = new URLSearchParams();
    params.set("weekStart", weekStart);
    return `/heatmap?${params.toString()}`;
  }

  return "/heatmap";
}

function HeatmapStatePreview({
  state,
  liveHref,
}: {
  state: HeatmapPreviewState;
  liveHref: string;
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
              href: "/requests?status=pending&sort=risk&dir=desc",
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
              href: "/requests?status=pending&sort=risk&dir=desc",
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
              href: "/requests?status=pending&sort=risk&dir=desc",
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
              href: "/requests?status=pending&sort=risk&dir=desc",
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
            href: "/requests?status=pending&sort=risk&dir=desc",
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

export default async function HeatmapPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const weekStartRaw = asString(sp.weekStart);
  const previewState = getHeatmapPreviewState(asString(sp.state));

  if (previewState) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
            Coverage heatmap
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            A manager-friendly snapshot of upcoming coverage pressure. Select a
            week to inspect pressure reasons, coverage matrix rows, and matching
            request context.
          </p>
        </div>

        <div className="mt-6">
          <DemoNotice compact />
        </div>

        <HeatmapStatePreview
          state={previewState}
          liveHref={liveHeatmapHref(weekStartRaw)}
        />
      </div>
    );
  }

  const repo = getDemoRepo();

  const heatmap = buildCalendarHeatmap({ repo, preset: "next-8-weeks" });

  const weeks: Array<{
    weekStart: IsoDate;
    weekEnd: IsoDate;
    worstBand: DemoCoverageBand;
    reasons: string[];
  }> = [];

  let cursor = heatmap.range.startDate;
  while (cursor <= heatmap.range.endDate) {
    const weekStart = cursor;
    const weekEndCandidate = addDaysIsoDate(cursor, 6);
    const weekEnd =
      weekEndCandidate > heatmap.range.endDate
        ? heatmap.range.endDate
        : weekEndCandidate;

    const days = eachDayInclusive(weekStart, weekEnd);
    const cells = heatmap.cells.filter((c) => days.includes(c.date));

    let worstBand: DemoCoverageBand = "healthy";
    const reasons: string[] = [];
    for (const c of cells) {
      if (bandRank(c.band) > bandRank(worstBand)) worstBand = c.band;
      for (const r of c.topPressureReasons) {
        if (!reasons.includes(r)) reasons.push(r);
      }
    }

    weeks.push({
      weekStart,
      weekEnd,
      worstBand,
      reasons: reasons.slice(0, 3),
    });

    cursor = addDaysIsoDate(cursor, 7);
  }

  let selectedWeekStart = heatmap.range.startDate;
  let selectionNotice: string | null = null;
  if (weekStartRaw) {
    if (!isIsoDate(weekStartRaw)) {
      selectionNotice =
        "The selected week was not valid. Showing the first available week.";
    } else if (
      weekStartRaw < heatmap.range.startDate ||
      weekStartRaw > heatmap.range.endDate
    ) {
      selectionNotice =
        "The selected week was outside the demo range. Showing the first available week.";
    } else {
      selectedWeekStart = weekStartRaw;
    }
  }

  const selectedWeekEndCandidate = addDaysIsoDate(selectedWeekStart, 6);
  const selectedWeekEnd =
    selectedWeekEndCandidate > heatmap.range.endDate
      ? heatmap.range.endDate
      : selectedWeekEndCandidate;
  const selectedDays = eachDayInclusive(selectedWeekStart, selectedWeekEnd);
  const selectedWeekCells = heatmap.cells.filter((c) =>
    selectedDays.includes(c.date),
  );

  let selectedWeekBand: DemoCoverageBand = "healthy";
  const selectedReasons: string[] = [];
  for (const cell of selectedWeekCells) {
    if (bandRank(cell.band) > bandRank(selectedWeekBand)) {
      selectedWeekBand = cell.band;
    }
    for (const reason of cell.topPressureReasons) {
      if (!selectedReasons.includes(reason)) selectedReasons.push(reason);
    }
  }

  const coverageRows = buildCoverageMatrix({
    repo,
    range: { start: selectedWeekStart, end: selectedWeekEnd },
  });

  const selectedQueue = buildQueue({
    repo,
    filters: {
      startDate: selectedWeekStart,
      endDate: selectedWeekEnd,
    },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
          Coverage heatmap
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          A manager-friendly snapshot of upcoming coverage pressure. Select a
          week to inspect pressure reasons, coverage matrix rows, and matching
          request context.
        </p>
      </div>

      <div className="mt-6">
        <DemoNotice compact />
      </div>

      {selectionNotice ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
          {selectionNotice}
        </div>
      ) : null}

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
            Healthy means coverage stays above minimum. Thin means a role sits
            at minimum. Risky means coverage drops below minimum. Critical means
            single-person exposure or a blackout-style window.
          </p>
        </div>
      </section>

      <section aria-label="Heatmap grid" className="mt-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {weeks.map((week) => {
            const selected = week.weekStart === selectedWeekStart;
            return (
              <Link
                key={week.weekStart}
                href={weekRangeHref(week.weekStart)}
                aria-current={selected ? "page" : undefined}
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
                  {week.reasons.length === 0 ? (
                    <p className="mt-1">
                      No elevated pressure signals in this week.
                    </p>
                  ) : (
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {week.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                    Range: {week.weekStart} to {week.weekEnd}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section
        aria-label="Selected week"
        className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
      >
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Selected week
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {formatShortDay(selectedWeekStart)} to{" "}
                {formatShortDay(selectedWeekEnd)}
              </p>
            </div>
            <RiskBadge band={selectedWeekBand} />
          </div>

          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300">
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Pressure reasons
            </div>
            {selectedReasons.length === 0 ? (
              <p className="mt-1">No elevated pressure signals in this week.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {selectedReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={requestRangeHref(selectedWeekStart, selectedWeekEnd)}
              className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Open queue for this window
            </Link>
            <Link
              href="/requests?status=pending&sort=risk&dir=desc"
              className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-50 dark:hover:bg-zinc-900"
            >
              Open the full queue
            </Link>
          </div>

          <div className="mt-6">
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Matching requests in this week
            </div>
            {selectedQueue.items.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                No requests overlap this selected week in the demo set.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {selectedQueue.items.slice(0, 3).map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/20"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link
                        href={`/requests/${item.id}`}
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
            )}
          </div>
        </div>

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
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600 dark:bg-zinc-950/40 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Required</th>
                  <th className="px-3 py-2 font-medium">Available</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {coverageRows.map((row) => (
                  <tr key={`${row.teamId}-${row.roleId}`} className="align-top">
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                      {row.teamName}
                    </td>
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                      <div className="font-medium text-zinc-950 dark:text-zinc-50">
                        {row.roleName}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatShortDay(selectedWeekStart)} to{" "}
                        {formatShortDay(selectedWeekEnd)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                      <span className="font-mono tabular-nums">
                        {row.required}
                      </span>
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
                        {row.singlePersonExposure
                          ? "Single-person role exposure"
                          : row.comparison === "below"
                            ? "Below required coverage"
                            : row.comparison === "exact"
                              ? "At the minimum"
                              : "Above required coverage"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}
