import type {
  DemoCoverageBand,
  DemoEmployee,
  DemoPtoRequest,
  DemoRole,
  DemoRequestStatus,
  DemoRequestType,
  DemoTeam,
} from "../../demo/dataset";
import type { DemoRepo } from "../../repos/demoRepo";
import type { IsoDate } from "../dates";
import { normalizeDateRange } from "../dates";
import type { ConflictLevel } from "../conflicts/conflictDetector";
import { createAssessmentForRequest } from "../assessment/createRequestAssessment";

export type QueueFilters = {
  teamId?: string;
  roleId?: string;
  requestType?: DemoRequestType;
  coverageBand?: DemoCoverageBand;
  startDate?: IsoDate;
  endDate?: IsoDate;
  status?: DemoRequestStatus;
  conflictLevel?: ConflictLevel;
};

export type QueueItem = {
  id: string;
  employee: { id: string; displayName: string };
  team: { id: string; name: string };
  role: { id: string; name: string };
  requestType: DemoRequestType;
  status: DemoRequestStatus;
  requestedStartDate: IsoDate;
  requestedEndDate: IsoDate;
  submittedAt: string;
  assessment: {
    score: number;
    band: DemoCoverageBand;
    recommendation: string;
    topReason: { code: string; summary: string };
    conflictLevel: ConflictLevel;
  };
};

export type QueueSortKey =
  | "risk"
  | "start_date"
  | "recommendation"
  | "conflict";

export type QueueSortDir = "asc" | "desc";

export const queueSortKeys = [
  "risk",
  "start_date",
  "recommendation",
  "conflict",
] as const;

function overlaps(
  a: { start: IsoDate; end: IsoDate },
  b: { start: IsoDate; end: IsoDate },
): boolean {
  return !(a.end < b.start || b.end < a.start);
}

function filterByDateRange(
  req: DemoPtoRequest,
  range: { start: IsoDate; end: IsoDate },
) {
  return overlaps(
    { start: req.requestedStartDate, end: req.requestedEndDate },
    range,
  );
}

function conflictRank(level: QueueItem["assessment"]["conflictLevel"]): number {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  if (level === "low") return 1;
  return 0;
}

function recommendationRank(
  rec: QueueItem["assessment"]["recommendation"],
): number {
  if (rec === "defer") return 3;
  if (rec === "needs_discussion") return 2;
  if (rec === "approve_with_coverage_actions") return 1;
  return 0;
}

function compareIds(a: QueueItem, b: QueueItem) {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function compareStartDateThenId(a: QueueItem, b: QueueItem, direction: number) {
  if (a.requestedStartDate !== b.requestedStartDate) {
    return direction * (a.requestedStartDate < b.requestedStartDate ? -1 : 1);
  }
  return compareIds(a, b);
}

function compareRankThenScoreThenId(
  rankA: number,
  rankB: number,
  a: QueueItem,
  b: QueueItem,
  direction: number,
) {
  const delta = rankA - rankB;
  if (delta !== 0) return direction * delta;
  if (a.assessment.score !== b.assessment.score) {
    return direction * (a.assessment.score - b.assessment.score);
  }
  return compareIds(a, b);
}

function compareRecommendation(a: QueueItem, b: QueueItem, direction: number) {
  return compareRankThenScoreThenId(
    recommendationRank(a.assessment.recommendation),
    recommendationRank(b.assessment.recommendation),
    a,
    b,
    direction,
  );
}

function compareConflict(a: QueueItem, b: QueueItem, direction: number) {
  return compareRankThenScoreThenId(
    conflictRank(a.assessment.conflictLevel),
    conflictRank(b.assessment.conflictLevel),
    a,
    b,
    direction,
  );
}

function compareRisk(a: QueueItem, b: QueueItem, direction: number) {
  if (a.assessment.score !== b.assessment.score) {
    return direction * (a.assessment.score - b.assessment.score);
  }
  return compareStartDateThenId(a, b, direction);
}

function compareQueueItemsByKey(
  a: QueueItem,
  b: QueueItem,
  key: QueueSortKey,
  direction: number,
) {
  if (key === "start_date") return compareStartDateThenId(a, b, direction);
  if (key === "recommendation") return compareRecommendation(a, b, direction);
  if (key === "conflict") return compareConflict(a, b, direction);
  return compareRisk(a, b, direction);
}

export function sortQueueItems(
  items: QueueItem[],
  key: QueueSortKey,
  dir: QueueSortDir,
): QueueItem[] {
  const direction = dir === "asc" ? 1 : -1;
  return items
    .slice()
    .sort((a, b) => compareQueueItemsByKey(a, b, key, direction));
}

type RequestContext = {
  request: DemoPtoRequest;
  employee: DemoEmployee;
  team: DemoTeam;
  role: DemoRole;
};

function resolveRequestContext(
  repo: DemoRepo,
  request: DemoPtoRequest,
): RequestContext | null {
  const employee = repo.employees.find((e) => e.id === request.employeeId);
  if (!employee) return null;
  const team = repo.teams.find((t) => t.id === employee.teamId);
  const role = repo.roles.find((r) => r.id === employee.roleId);
  if (!team || !role) return null;
  return { request, employee, team, role };
}

function normalizeOptionalDateRange(filters: QueueFilters) {
  if (!filters.startDate || !filters.endDate) return null;
  return normalizeDateRange({ start: filters.startDate, end: filters.endDate });
}

function requestMatchesIdentityFilters(
  context: RequestContext,
  filters: QueueFilters,
) {
  if (filters.teamId && context.team.id !== filters.teamId) return false;
  if (filters.roleId && context.role.id !== filters.roleId) return false;
  if (
    filters.requestType &&
    context.request.requestType !== filters.requestType
  )
    return false;
  if (filters.status && context.request.status !== filters.status) return false;
  return true;
}

function requestMatchesDateFilter(
  request: DemoPtoRequest,
  dateRange: { start: IsoDate; end: IsoDate } | null,
) {
  return !dateRange || filterByDateRange(request, dateRange);
}

function assessmentMatchesFilters(
  assessment: ReturnType<typeof createAssessmentForRequest>,
  filters: QueueFilters,
) {
  if (filters.coverageBand && assessment.band !== filters.coverageBand) {
    return false;
  }
  if (
    filters.conflictLevel &&
    assessment.conflicts.level !== filters.conflictLevel
  )
    return false;
  return true;
}

function defaultTopReason(
  assessment: ReturnType<typeof createAssessmentForRequest>,
) {
  return (
    assessment.reasons[0] ?? {
      code: "none",
      summary: "No elevated risk signals detected in the demo dataset.",
    }
  );
}

function buildQueueItemFromAssessment(
  context: RequestContext,
  assessment: ReturnType<typeof createAssessmentForRequest>,
): QueueItem {
  const { request, employee, team, role } = context;
  const topReason = defaultTopReason(assessment);

  return {
    id: request.id,
    employee: { id: employee.id, displayName: employee.displayName },
    team: { id: team.id, name: team.name },
    role: { id: role.id, name: role.name },
    requestType: request.requestType,
    status: request.status,
    requestedStartDate: request.requestedStartDate,
    requestedEndDate: request.requestedEndDate,
    submittedAt: request.submittedAt,
    assessment: {
      score: assessment.score,
      band: assessment.band,
      recommendation: assessment.recommendation,
      topReason: { code: topReason.code, summary: topReason.summary },
      conflictLevel: assessment.conflicts.level,
    },
  };
}

function buildQueueItem(
  repo: DemoRepo,
  request: DemoPtoRequest,
  filters: QueueFilters,
  dateRange: { start: IsoDate; end: IsoDate } | null,
): QueueItem | null {
  const context = resolveRequestContext(repo, request);
  if (!context) return null;
  if (!requestMatchesIdentityFilters(context, filters)) return null;
  if (!requestMatchesDateFilter(request, dateRange)) return null;

  const assessment = createAssessmentForRequest({
    repo,
    request,
    teamId: context.team.id,
    roleId: context.role.id,
  });

  if (!assessmentMatchesFilters(assessment, filters)) return null;
  return buildQueueItemFromAssessment(context, assessment);
}

function defaultQueueSort(a: QueueItem, b: QueueItem) {
  if (a.assessment.score !== b.assessment.score)
    return b.assessment.score - a.assessment.score;
  if (a.requestedStartDate !== b.requestedStartDate)
    return a.requestedStartDate < b.requestedStartDate ? -1 : 1;
  return compareIds(a, b);
}

function buildQueueMeta(
  filters: QueueFilters,
  dateRange: { start: IsoDate; end: IsoDate } | null,
  total: number,
) {
  return {
    total,
    filters: {
      ...filters,
      ...(dateRange
        ? { startDate: dateRange.start, endDate: dateRange.end }
        : {}),
    },
  };
}

export function buildQueue(args: { repo: DemoRepo; filters: QueueFilters }) {
  const { repo, filters } = args;
  const dateRange = normalizeOptionalDateRange(filters);
  const items = repo.ptoRequests
    .map((request) => buildQueueItem(repo, request, filters, dateRange))
    .filter((item): item is QueueItem => item !== null);

  // Deterministic ordering: highest risk first, then start date, then id.
  items.sort(defaultQueueSort);

  return {
    meta: buildQueueMeta(filters, dateRange, items.length),
    items,
  };
}
