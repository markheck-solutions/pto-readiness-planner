import Link from "next/link";

import { DemoNotice } from "../_components/DemoNotice";

import { RiskBadge } from "../_components/StatusBadges";

import type { DemoCoverageBand } from "../../src/demo/dataset";
import {
  addDaysIsoDate,
  eachDayInclusive,
  parseIsoDate,
  type IsoDate,
} from "../../src/domain/dates";
import { buildCalendarHeatmap } from "../../src/domain/heatmap/heatmapBuilder";
import { getDemoRepo } from "../../src/repos/demoRepo";

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

export default function HeatmapPage() {
  const repo = getDemoRepo();
  const heatmap = buildCalendarHeatmap({ repo, preset: "next-8-weeks" });

  const start = heatmap.range.startDate;
  const end = heatmap.range.endDate;

  const weeks: Array<{
    weekStart: IsoDate;
    weekEnd: IsoDate;
    worstBand: DemoCoverageBand;
    reasons: string[];
  }> = [];

  let cursor = start;
  while (cursor <= end) {
    const weekStart = cursor;
    const weekEndCandidate = addDaysIsoDate(cursor, 6);
    const weekEnd = weekEndCandidate > end ? end : weekEndCandidate;

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

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
          Coverage heatmap
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          A manager-friendly snapshot of upcoming coverage pressure. Each week shows the worst
          coverage band seen in that week and a few plain-language pressure reasons.
        </p>
      </div>

      <div className="mt-6">
        <DemoNotice compact />
      </div>

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
            Healthy means coverage stays above minimum. Thin means a role sits at minimum. Risky
            means coverage drops below minimum. Critical indicates single-person exposure or a
            blackout-style window.
          </p>
        </div>
      </section>

      <section aria-label="Heatmap grid" className="mt-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {weeks.map((w) => (
            <div
              key={w.weekStart}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  Week of {formatShortDay(w.weekStart)}
                </div>
                <RiskBadge band={w.worstBand} />
              </div>
              <div className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Pressure reasons
                </div>
                {w.reasons.length === 0 ? (
                  <p className="mt-1">No elevated pressure signals in this week.</p>
                ) : (
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {w.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                  Range: {w.weekStart} to {w.weekEnd}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Next steps" className="mt-10 max-w-3xl">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Next step in the walkthrough
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Open a request to review the deterministic assessment and see the manager-friendly
          reasoning behind the recommendation.
        </p>
        <div className="mt-4">
          <Link
            href="/requests?status=pending&sort=risk&dir=desc"
            className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Open the request queue
          </Link>
        </div>
      </section>
    </div>
  );
}
