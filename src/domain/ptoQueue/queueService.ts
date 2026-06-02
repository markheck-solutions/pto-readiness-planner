import type {
  DemoCoverageBand,
  DemoPtoRequest,
  DemoRequestStatus,
  DemoRequestType,
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
  | "conflict"

export type QueueSortDir = "asc" | "desc"

export const queueSortKeys = [
  "risk",
  "start_date",
  "recommendation",
  "conflict",
] as const

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
  if (level === "high") return 3
  if (level === "medium") return 2
  if (level === "low") return 1
  return 0
}

function recommendationRank(
  rec: QueueItem["assessment"]["recommendation"],
): number {
  if (rec === "defer") return 3
  if (rec === "needs_discussion") return 2
  if (rec === "approve_with_coverage_actions") return 1
  return 0
}

export function sortQueueItems(
  items: QueueItem[],
  key: QueueSortKey,
  dir: QueueSortDir,
): QueueItem[] {
  const direction = dir === "asc" ? 1 : -1
  return items.slice().sort((a, b) => {
    if (key === "start_date") {
      if (a.requestedStartDate !== b.requestedStartDate) {
        return (
          direction * (a.requestedStartDate < b.requestedStartDate ? -1 : 1)
        )
      }
      if (a.id !== b.id) return a.id < b.id ? -1 : 1
      return 0
    }

    if (key === "recommendation") {
      const delta =
        recommendationRank(a.assessment.recommendation) -
        recommendationRank(b.assessment.recommendation)
      if (delta !== 0) return direction * delta
      if (a.assessment.score !== b.assessment.score) {
        return direction * (a.assessment.score - b.assessment.score)
      }
      return a.id < b.id ? -1 : 1
    }

    if (key === "conflict") {
      const delta =
        conflictRank(a.assessment.conflictLevel) -
        conflictRank(b.assessment.conflictLevel)
      if (delta !== 0) return direction * delta
      if (a.assessment.score !== b.assessment.score) {
        return direction * (a.assessment.score - b.assessment.score)
      }
      return a.id < b.id ? -1 : 1
    }

    if (a.assessment.score !== b.assessment.score) {
      return direction * (a.assessment.score - b.assessment.score)
    }
    if (a.requestedStartDate !== b.requestedStartDate) {
      return (
        direction * (a.requestedStartDate < b.requestedStartDate ? -1 : 1)
      )
    }
    return a.id < b.id ? -1 : 1
  })
}

export function buildQueue(args: { repo: DemoRepo; filters: QueueFilters }) {
  const { repo, filters } = args;

  const dateRange =
    filters.startDate && filters.endDate
      ? normalizeDateRange({ start: filters.startDate, end: filters.endDate })
      : null;

  const items: QueueItem[] = [];

  for (const request of repo.ptoRequests) {
    const employee = repo.employees.find((e) => e.id === request.employeeId);
    if (!employee) continue;
    const team = repo.teams.find((t) => t.id === employee.teamId);
    const role = repo.roles.find((r) => r.id === employee.roleId);
    if (!team || !role) continue;

    if (filters.teamId && team.id !== filters.teamId) continue;
    if (filters.roleId && role.id !== filters.roleId) continue;
    if (filters.requestType && request.requestType !== filters.requestType)
      continue;
    if (filters.status && request.status !== filters.status) continue;

    if (dateRange && !filterByDateRange(request, dateRange)) continue;

    const assessment = createAssessmentForRequest({
      repo,
      request,
      teamId: team.id,
      roleId: role.id,
    });

    if (filters.coverageBand && assessment.band !== filters.coverageBand)
      continue;
    if (
      filters.conflictLevel &&
      assessment.conflicts.level !== filters.conflictLevel
    )
      continue;

    const topReason = assessment.reasons[0] ?? {
      code: "none",
      summary: "No elevated risk signals detected in the demo dataset.",
    };

    items.push({
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
    });
  }

  // Deterministic ordering: highest risk first, then start date, then id.
  items.sort((a, b) => {
    if (a.assessment.score !== b.assessment.score)
      return b.assessment.score - a.assessment.score;
    if (a.requestedStartDate !== b.requestedStartDate)
      return a.requestedStartDate < b.requestedStartDate ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return {
    meta: {
      total: items.length,
      filters: {
        ...filters,
        ...(dateRange
          ? { startDate: dateRange.start, endDate: dateRange.end }
          : {}),
      },
    },
    items,
  };
}
