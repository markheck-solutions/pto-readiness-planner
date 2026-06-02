import Link from "next/link";

import { DemoNotice } from "./_components/DemoNotice";
import { KpiCard } from "./_components/KpiCard";
import {
  LoadingStateSkeleton,
  SafeStatePanel,
} from "./_components/SafeStatePanel";
import { RiskBadge } from "./_components/StatusBadges";

import { buildCoverageMatrix } from "../src/domain/coverage/coverageMatrix";
import {
  addDaysIsoDate,
  eachDayInclusive,
  parseIsoDate,
  type IsoDate,
} from "../src/domain/dates";
import { buildCalendarHeatmap } from "../src/domain/heatmap/heatmapBuilder";
import { buildQueue } from "../src/domain/ptoQueue/queueService";
import type { DemoCoverageBand } from "../src/demo/dataset";
import { getDemoRepo } from "../src/repos/demoRepo";

type SearchParams = Record<string, string | string[] | undefined>;
type OverviewPreviewState = "loading" | "no-urgent" | "unavailable" | "error";

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

function formatDateRange(start: IsoDate, end: IsoDate): string {
  if (start === end) return formatShortDay(start);
  return `${formatShortDay(start)} to ${formatShortDay(end)}`;
}

function bandRank(band: DemoCoverageBand): number {
  if (band === "critical") return 3;
  if (band === "risky") return 2;
  if (band === "thin") return 1;
  return 0;
}

function getOverviewPreviewState(
  value: string | undefined,
): OverviewPreviewState | null {
  if (value === "loading") return "loading";
  if (value === "no-urgent") return "no-urgent";
  if (value === "unavailable") return "unavailable";
  if (value === "error") return "error";
  return null;
}

function buildDetailHref(requestId: string): string {
  const params = new URLSearchParams();
  params.set("status", "pending");
  params.set("sort", "risk");
  params.set("dir", "desc");
  return `/requests/${requestId}?${params.toString()}`;
}

function OverviewStatePreview({ state }: { state: OverviewPreviewState }) {
  if (state === "loading") {
    return (
      <SafeStatePanel
        label="Overview loading preview"
        title="Loading the manager overview"
        description="The overview is still preparing the latest queue summary. Final counts stay hidden until the data is ready, so managers never see half-loaded totals."
        tone="info"
        role="status"
        ariaLive="polite"
        actions={[
          { href: "/", label: "Return to live overview" },
          {
            href: "/requests?status=pending&sort=risk&dir=desc",
            label: "Open PTO request queue",
            variant: "secondary",
          },
        ]}
        bullets={[
          "Use the queue if you need to keep reviewing requests while the summary finishes loading.",
          "The overview swaps back to live counts once the ready state returns.",
        ]}
      >
        <LoadingStateSkeleton cards={5} />
      </SafeStatePanel>
    );
  }

  if (state === "no-urgent") {
    return (
      <SafeStatePanel
        label="Overview no-urgent preview"
        title="No urgent items need triage right now"
        description="This safe state shows the overview when nothing in the current review window needs immediate escalation. Managers can still open the queue or scan coverage before the next decision."
        tone="neutral"
        actions={[
          {
            href: "/requests?status=pending&sort=risk&dir=desc",
            label: "Open the full queue",
          },
          {
            href: "/heatmap",
            label: "Check the coverage heatmap",
            variant: "secondary",
          },
        ]}
        bullets={[
          "Use this view to confirm that today’s requests can be handled in normal review order.",
          "No live KPI totals are shown here, which prevents stale summary data from lingering behind the calm-state message.",
        ]}
      />
    );
  }

  if (state === "unavailable") {
    return (
      <SafeStatePanel
        label="Overview unavailable-data preview"
        title="Overview data is temporarily unavailable"
        description="The high-level summary could not be refreshed just now. Use the queue or heatmap while the overview reconnects, then return to the live view."
        tone="caution"
        role="status"
        ariaLive="polite"
        actions={[
          { href: "/", label: "Retry the live overview" },
          {
            href: "/requests?status=pending&sort=risk&dir=desc",
            label: "Open PTO request queue",
            variant: "secondary",
          },
          {
            href: "/heatmap",
            label: "Open coverage heatmap",
            variant: "secondary",
          },
        ]}
        bullets={[
          "The fallback hides final KPI totals until the summary is available again.",
          "No technical diagnostics or provider details are exposed in this browser state.",
        ]}
      />
    );
  }

  return (
    <SafeStatePanel
      label="Overview error preview"
      title="Overview could not be loaded right now"
      description="Something interrupted the overview refresh. Retry the live overview or move to another safe surface while this page recovers."
      tone="danger"
      role="alert"
      ariaLive="assertive"
      actions={[
        { href: "/", label: "Retry the live overview" },
        {
          href: "/requests?status=pending&sort=risk&dir=desc",
          label: "Review requests instead",
          variant: "secondary",
        },
        {
          href: "/heatmap",
          label: "Open coverage heatmap",
          variant: "secondary",
        },
      ]}
      bullets={[
        "The fallback keeps managers on a recoverable path without showing stale cards or raw technical details.",
        "Refresh or use the safe navigation links above when you are ready to continue.",
      ]}
    />
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const previewState = getOverviewPreviewState(asString(sp.state));

  if (previewState) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
        <section
          aria-label="Manager overview"
          className="grid gap-8 lg:grid-cols-3"
        >
          <div className="lg:col-span-2">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
              PTO coverage readiness command center
            </h1>
            <p className="mt-4 text-pretty text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
              Triage PTO requests by coverage pressure, critical windows, and
              conflict risk. This is decision support for managers, not a live
              HR workflow.
            </p>

            <div className="mt-7">
              <DemoNotice />
            </div>
          </div>
        </section>

        <div className="mt-10">
          <OverviewStatePreview state={previewState} />
        </div>
      </div>
    );
  }

  const repo = getDemoRepo();
  const queue = buildQueue({ repo, filters: {} });

  const pending = queue.items.filter((i) => i.status === "pending");
  const highRisk = queue.items.filter(
    (i) =>
      i.status === "pending" &&
      (i.assessment.band === "critical" || i.assessment.band === "risky"),
  );

  const coverageRows = buildCoverageMatrix({
    repo,
    range: {
      start: repo.meta.dateBounds.startDate,
      end: repo.meta.dateBounds.endDate,
    },
  });
  const exposedRoles = coverageRows.filter(
    (r) => r.comparison !== "above" || r.singlePersonExposure,
  );

  const heatmap = buildCalendarHeatmap({
    repo,
    preset: "next-8-weeks",
  });
  const today = repo.meta.dateBounds.startDate;
  const nextWeek = eachDayInclusive(today, addDaysIsoDate(today, 6));
  const nextWeekCells = heatmap.cells.filter((c) => nextWeek.includes(c.date));
  const nextWeekCriticalOrRisky = nextWeekCells.filter(
    (c) => c.band === "critical" || c.band === "risky",
  ).length;
  const nextWeekThin = nextWeekCells.filter((c) => c.band === "thin").length;

  const upcomingWindows = repo.criticalWindows
    .filter((w) => w.endDate >= today)
    .slice()
    .sort((a, b) =>
      a.startDate === b.startDate
        ? a.id < b.id
          ? -1
          : 1
        : a.startDate < b.startDate
          ? -1
          : 1,
    );

  const topUrgent = pending
    .slice()
    .sort((a, b) => {
      const bandDelta =
        bandRank(b.assessment.band) - bandRank(a.assessment.band);
      if (bandDelta !== 0) return bandDelta;
      if (a.assessment.score !== b.assessment.score)
        return b.assessment.score - a.assessment.score;
      return a.id < b.id ? -1 : 1;
    })
    .slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <section
        aria-label="Manager overview"
        className="grid gap-8 lg:grid-cols-3"
      >
        <div className="lg:col-span-2">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
            PTO coverage readiness command center
          </h1>
          <p className="mt-4 text-pretty text-base leading-7 text-zinc-700 dark:text-zinc-300 sm:text-lg">
            Triage PTO requests by coverage pressure, critical windows, and
            conflict risk. This is decision support for managers, not a live HR
            workflow.
          </p>

          <div className="mt-7">
            <DemoNotice />
          </div>
        </div>

        <aside
          aria-label="Next actions"
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
        >
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Next actions
          </div>
          <h2 className="mt-2 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Focus the highest-risk items first
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            <li>
              <Link
                href="/requests?coverageBand=critical&status=pending&sort=risk&dir=desc"
                className="font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
              >
                Review critical requests
              </Link>{" "}
              {highRisk.some((r) => r.assessment.band === "critical") ? (
                <span className="text-zinc-600 dark:text-zinc-400">
                  (
                  {
                    highRisk.filter((r) => r.assessment.band === "critical")
                      .length
                  }{" "}
                  pending)
                </span>
              ) : (
                <span className="text-zinc-600 dark:text-zinc-400">
                  (none right now in this demo set)
                </span>
              )}
            </li>
            <li>
              <Link
                href="/requests?coverageBand=risky&status=pending&sort=risk&dir=desc"
                className="font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
              >
                Work the risky queue
              </Link>{" "}
              <span className="text-zinc-600 dark:text-zinc-400">
                ({highRisk.filter((r) => r.assessment.band === "risky").length}{" "}
                pending)
              </span>
            </li>
            <li>
              <Link
                href="/heatmap"
                className="font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
              >
                Scan the heatmap before approving overlaps
              </Link>{" "}
              <span className="text-zinc-600 dark:text-zinc-400">
                (next week has {nextWeekCriticalOrRisky} risky or critical days)
              </span>
            </li>
          </ul>
        </aside>
      </section>

      <section aria-label="KPI summary" className="mt-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Pending requests"
            value={String(pending.length)}
            helper="Items that need a manager decision."
            href="/requests?status=pending&sort=risk&dir=desc"
          />
          <KpiCard
            label="High-risk requests"
            value={String(highRisk.length)}
            helper="Critical or risky coverage bands in pending work."
            href="/requests?status=pending&sort=risk&dir=desc"
          />
          <KpiCard
            label="Exposed roles"
            value={String(exposedRoles.length)}
            helper="Roles at or below minimum coverage in the demo range."
            href="/heatmap"
          />
          <KpiCard
            label="Weekly pressure"
            value={`${nextWeekCriticalOrRisky} risk / ${nextWeekThin} thin`}
            helper="Days next week with elevated coverage pressure."
            href="/heatmap"
          />
          <KpiCard
            label="Critical windows"
            value={String(upcomingWindows.length)}
            helper="Upcoming delivery windows, freezes, and blackouts."
            href="/heatmap"
          />
        </div>
      </section>

      <section
        aria-label="Urgent watchlist"
        className="mt-10 grid gap-6 lg:grid-cols-2"
      >
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Urgent watchlist
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                The top items you would open first in a real review.
              </p>
            </div>
            <Link
              href="/requests?status=pending&sort=risk&dir=desc"
              className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
            >
              Open queue
            </Link>
          </div>

          {topUrgent.length === 0 ? (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
              No pending requests in the current demo dataset.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {topUrgent.map((r) => (
                <li key={r.id}>
                  <Link
                    href={buildDetailHref(r.id)}
                    className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/20 dark:hover:border-zinc-700 dark:hover:bg-zinc-950/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {r.employee.displayName}{" "}
                        <span className="text-zinc-500 dark:text-zinc-400">
                          ({r.id})
                        </span>
                      </div>
                      <RiskBadge
                        band={r.assessment.band}
                        score={r.assessment.score}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <span className="font-medium">{r.team.name}</span>
                      <span
                        className="text-zinc-500 dark:text-zinc-400"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <span>{r.role.name}</span>
                      <span
                        className="text-zinc-500 dark:text-zinc-400"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <span>
                        {formatDateRange(
                          r.requestedStartDate,
                          r.requestedEndDate,
                        )}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {r.assessment.topReason.summary}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Upcoming critical windows
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            These weeks are where approvals need extra care.
          </p>

          {upcomingWindows.length === 0 ? (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
              No critical windows in the current demo range.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcomingWindows.slice(0, 3).map((w) => (
                <li
                  key={w.id}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      {w.title}
                    </div>
                    <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {formatDateRange(w.startDate, w.endDate)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {w.description}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <Link
              href="/heatmap"
              className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
            >
              Open heatmap
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
