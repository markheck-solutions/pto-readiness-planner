import type { DemoCoverageBand } from "../../src/demo/dataset";
import {
  addDaysIsoDate,
  eachDayInclusive,
  isIsoDate,
  type IsoDate,
} from "../../src/domain/dates";
import {
  buildCoverageMatrix,
  type CoverageMatrixRow,
} from "../../src/domain/coverage/coverageMatrix";
import { buildCalendarHeatmap } from "../../src/domain/heatmap/heatmapBuilder";
import {
  buildQueue,
  queueSortKeys,
  sortQueueItems,
  type QueueItem,
} from "../../src/domain/ptoQueue/queueService";
import {
  buildReviewHref,
  readReviewFilterQuery,
  withDefaultQueueSort,
  withSelectedWeekRange,
  withWeekStartFromDateRange,
  withoutSelectedWeekRange,
  type ReviewFilterQuery,
} from "../../src/domain/reviewFilters";
import type { DemoRepo } from "../../src/repos/demoRepo";

export type HeatmapPreviewState = "loading" | "empty" | "error";

export type HeatmapWeek = {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  worstBand: DemoCoverageBand;
  reasons: string[];
};

export type SelectedHeatmapWeek = {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  band: DemoCoverageBand;
  reasons: string[];
  coverageRows: CoverageMatrixRow[];
  queueItems: QueueItem[];
};

export type HeatmapPageModel = {
  reviewQuery: ReviewFilterQuery;
  previewState: HeatmapPreviewState | null;
  liveHref: string;
  queueHref: string;
  selectionNotice: string | null;
  weeks: HeatmapWeek[];
  selected: SelectedHeatmapWeek | null;
};

function bandRank(band: DemoCoverageBand): number {
  if (band === "critical") return 3;
  if (band === "risky") return 2;
  if (band === "thin") return 1;
  return 0;
}

export function bandLabel(band: DemoCoverageBand): string {
  if (band === "critical") return "Critical";
  if (band === "risky") return "Risky";
  if (band === "thin") return "Thin";
  return "Healthy";
}

function getHeatmapPreviewState(
  value: string | undefined,
): HeatmapPreviewState | null {
  if (value === "loading") return "loading";
  if (value === "empty") return "empty";
  if (value === "error") return "error";
  return null;
}

function liveHeatmapHref(query: ReviewFilterQuery): string {
  const liveQuery = withWeekStartFromDateRange(query);
  const weekStart = liveQuery.weekStart;
  if (weekStart && isIsoDate(weekStart)) {
    return buildReviewHref("/heatmap", liveQuery);
  }

  return buildReviewHref("/heatmap", query);
}

export function weekRangeHref(
  query: ReviewFilterQuery,
  weekStart: IsoDate,
  weekEnd: IsoDate,
): string {
  return buildReviewHref(
    "/heatmap",
    withSelectedWeekRange(query, weekStart, weekEnd),
  );
}

export function requestRangeHref(
  query: ReviewFilterQuery,
  weekStart: IsoDate,
  weekEnd: IsoDate,
): string {
  return buildReviewHref(
    "/requests",
    withDefaultQueueSort(withSelectedWeekRange(query, weekStart, weekEnd)),
  );
}

export function requestDetailHref(
  query: ReviewFilterQuery,
  requestId: string,
  weekStart: IsoDate,
  weekEnd: IsoDate,
): string {
  return buildReviewHref(
    `/requests/${requestId}`,
    withDefaultQueueSort(withSelectedWeekRange(query, weekStart, weekEnd)),
  );
}

function weekBandAndReasons(
  cells: Array<{ band: DemoCoverageBand; topPressureReasons: string[] }>,
) {
  let worstBand: DemoCoverageBand = "healthy";
  const reasons: string[] = [];

  for (const cell of cells) {
    if (bandRank(cell.band) > bandRank(worstBand)) worstBand = cell.band;
    for (const reason of cell.topPressureReasons) {
      if (!reasons.includes(reason)) reasons.push(reason);
    }
  }

  return { worstBand, reasons: reasons.slice(0, 3) };
}

function buildWeeks(
  heatmap: ReturnType<typeof buildCalendarHeatmap>,
): HeatmapWeek[] {
  const weeks: HeatmapWeek[] = [];
  let cursor = heatmap.range.startDate;

  while (cursor <= heatmap.range.endDate) {
    const weekStart = cursor;
    const weekEndCandidate = addDaysIsoDate(cursor, 6);
    const weekEnd =
      weekEndCandidate > heatmap.range.endDate
        ? heatmap.range.endDate
        : weekEndCandidate;
    const days = eachDayInclusive(weekStart, weekEnd);
    const cells = heatmap.cells.filter((cell) => days.includes(cell.date));
    const summary = weekBandAndReasons(cells);

    weeks.push({
      weekStart,
      weekEnd,
      worstBand: summary.worstBand,
      reasons: summary.reasons,
    });
    cursor = addDaysIsoDate(cursor, 7);
  }

  return weeks;
}

function selectedWeekStart(
  raw: string | undefined,
  range: { startDate: IsoDate; endDate: IsoDate },
) {
  if (!raw) return { weekStart: range.startDate, notice: null };
  if (!isIsoDate(raw)) {
    return {
      weekStart: range.startDate,
      notice:
        "The selected week was not valid. Showing the first available week.",
    };
  }
  if (raw < range.startDate || raw > range.endDate) {
    return {
      weekStart: range.startDate,
      notice:
        "The selected week was outside the demo range. Showing the first available week.",
    };
  }
  return { weekStart: raw, notice: null };
}

function selectedWeekEnd(weekStart: IsoDate, rangeEnd: IsoDate): IsoDate {
  const candidate = addDaysIsoDate(weekStart, 6);
  return candidate > rangeEnd ? rangeEnd : candidate;
}

function selectedQueueItems(args: {
  repo: DemoRepo;
  query: ReviewFilterQuery;
  weekStart: IsoDate;
  weekEnd: IsoDate;
}) {
  const { repo, query, weekStart, weekEnd } = args;
  const selectedQueue = buildQueue({
    repo,
    filters: {
      teamId: query.teamId,
      roleId: query.roleId,
      requestType: query.requestType as "pto" | "training" | undefined,
      status: query.status as "pending" | "approved" | "withdrawn" | undefined,
      coverageBand: query.coverageBand as
        | "healthy"
        | "thin"
        | "risky"
        | "critical"
        | undefined,
      conflictLevel: query.conflictLevel as
        | "none"
        | "low"
        | "medium"
        | "high"
        | undefined,
      startDate: weekStart,
      endDate: weekEnd,
    },
  });
  const selectedQueueSort = withDefaultQueueSort(query);
  const sortKey = queueSortKeys.includes(
    selectedQueueSort.sort as (typeof queueSortKeys)[number],
  )
    ? (selectedQueueSort.sort as (typeof queueSortKeys)[number])
    : "risk";
  const sortDir = selectedQueueSort.dir === "asc" ? "asc" : "desc";
  return sortQueueItems(selectedQueue.items, sortKey, sortDir);
}

function buildSelectedWeek(args: {
  repo: DemoRepo;
  heatmap: ReturnType<typeof buildCalendarHeatmap>;
  query: ReviewFilterQuery;
  weekStart: IsoDate;
}): SelectedHeatmapWeek {
  const { repo, heatmap, query, weekStart } = args;
  const weekEnd = selectedWeekEnd(weekStart, heatmap.range.endDate);
  const selectedDays = eachDayInclusive(weekStart, weekEnd);
  const cells = heatmap.cells.filter((cell) =>
    selectedDays.includes(cell.date),
  );
  const summary = weekBandAndReasons(cells);

  return {
    weekStart,
    weekEnd,
    band: summary.worstBand,
    reasons: summary.reasons,
    coverageRows: buildCoverageMatrix({
      repo,
      range: { start: weekStart, end: weekEnd },
      teamId: query.teamId,
      roleId: query.roleId,
    }),
    queueItems: selectedQueueItems({ repo, query, weekStart, weekEnd }),
  };
}

export function buildHeatmapPageModel(
  repo: DemoRepo,
  searchParams: Record<string, string | string[] | undefined>,
): HeatmapPageModel {
  const reviewQuery = withWeekStartFromDateRange(
    readReviewFilterQuery(searchParams),
  );
  const previewState = getHeatmapPreviewState(
    Array.isArray(searchParams.state)
      ? searchParams.state[0]
      : searchParams.state,
  );
  const queueHref = buildReviewHref(
    "/requests",
    withDefaultQueueSort(withoutSelectedWeekRange(reviewQuery)),
  );

  if (previewState) {
    return {
      reviewQuery,
      previewState,
      liveHref: liveHeatmapHref(reviewQuery),
      queueHref,
      selectionNotice: null,
      weeks: [],
      selected: null,
    };
  }

  const heatmap = buildCalendarHeatmap({
    repo,
    preset: "next-8-weeks",
    teamId: reviewQuery.teamId,
    roleId: reviewQuery.roleId,
  });
  const selectedStart = selectedWeekStart(reviewQuery.weekStart, heatmap.range);

  return {
    reviewQuery,
    previewState,
    liveHref: liveHeatmapHref(reviewQuery),
    queueHref,
    selectionNotice: selectedStart.notice,
    weeks: buildWeeks(heatmap),
    selected: buildSelectedWeek({
      repo,
      heatmap,
      query: reviewQuery,
      weekStart: selectedStart.weekStart,
    }),
  };
}
