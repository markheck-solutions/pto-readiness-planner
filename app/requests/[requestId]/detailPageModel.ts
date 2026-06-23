import { isIsoDate, type IsoDate } from "../../../src/domain/dates";
import {
  createAssessmentForRequest,
  type PtoRequestAssessment,
} from "../../../src/domain/assessment/createRequestAssessment";
import {
  buildReviewHref,
  readReviewFilterQuery,
  withWeekStartFromDateRange,
  type ReviewFilterQuery,
} from "../../../src/domain/reviewFilters";
import type {
  DemoEmployee,
  DemoPtoRequest,
  DemoRole,
  DemoTeam,
} from "../../../src/demo/dataset";
import {
  findEmployeeById,
  findPtoRequestById,
  findRoleById,
  findTeamById,
  type DemoRepo,
} from "../../../src/repos/demoRepo";

export type DetailPreviewState = "no-selection" | "loading" | "error";

export type RequestReviewContext = {
  heatmapHref: string;
  weekStart: IsoDate;
  weekEnd: IsoDate;
};

export type RequestBackupOption = {
  id: string;
  displayName: string;
  available: boolean;
  note: string;
};

export type LoadedRequestDetail = {
  request: DemoPtoRequest;
  employee: DemoEmployee;
  team: DemoTeam;
  role: DemoRole;
  assessment: PtoRequestAssessment;
  backupOptions: RequestBackupOption[];
};

export type RequestDetailPageModel = {
  requestId: string;
  reviewQuery: ReviewFilterQuery;
  previewState: DetailPreviewState | null;
  queueHref: string;
  reviewContext: RequestReviewContext | null;
  detail: LoadedRequestDetail | null;
};

function firstSearchParam(value: string | string[] | undefined) {
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
  repo: DemoRepo,
  employeeId: string,
  range: { start: IsoDate; end: IsoDate },
): boolean {
  const absenceConflict = repo.existingAbsences.some(
    (absence) =>
      absence.employeeId === employeeId &&
      overlaps(range, { start: absence.startDate, end: absence.endDate }),
  );
  const requestConflict = repo.ptoRequests.some(
    (request) =>
      request.employeeId === employeeId &&
      request.status !== "withdrawn" &&
      overlaps(range, {
        start: request.requestedStartDate,
        end: request.requestedEndDate,
      }),
  );

  return !absenceConflict && !requestConflict;
}

function getDetailPreviewState(
  value: string | undefined,
): DetailPreviewState | null {
  if (value === "no-selection") return "no-selection";
  if (value === "loading") return "loading";
  if (value === "error") return "error";
  return null;
}

function buildHeatmapHref(query: ReviewFilterQuery): string | null {
  const weekQuery = withWeekStartFromDateRange(query);
  const weekStart = weekQuery.weekStart;
  if (!weekStart || !isIsoDate(weekStart)) return null;
  return buildReviewHref("/heatmap", weekQuery);
}

function reviewContextFor(
  query: ReviewFilterQuery,
): RequestReviewContext | null {
  const heatmapHref = buildHeatmapHref(query);
  const weekStart = query.weekStart;
  const weekEnd = query.endDate;
  if (!heatmapHref || !weekStart || !weekEnd) return null;
  if (!isIsoDate(weekStart) || !isIsoDate(weekEnd)) return null;
  return { heatmapHref, weekStart, weekEnd };
}

function backupNote(available: boolean) {
  return available
    ? "Available for the selected window."
    : "Already booked or absent during part of the selected window.";
}

function backupOptionsFor(args: {
  repo: DemoRepo;
  request: DemoPtoRequest;
  employee: DemoEmployee;
  team: DemoTeam;
  role: DemoRole;
}): RequestBackupOption[] {
  const { repo, request, employee, team, role } = args;
  return repo.employees
    .filter((candidate) => candidate.teamId === team.id)
    .filter((candidate) => candidate.roleId === role.id)
    .filter((candidate) => candidate.id !== employee.id)
    .map((candidate) => {
      const available = employeeAvailableForRange(repo, candidate.id, {
        start: request.requestedStartDate,
        end: request.requestedEndDate,
      });

      return {
        id: candidate.id,
        displayName: candidate.displayName,
        available,
        note: backupNote(available),
      };
    })
    .sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.displayName < b.displayName ? -1 : 1;
    });
}

function loadRequestDetail(
  repo: DemoRepo,
  requestId: string,
): LoadedRequestDetail | null {
  const request = findPtoRequestById(repo, requestId);
  const employee = request ? findEmployeeById(repo, request.employeeId) : null;
  const team = employee ? findTeamById(repo, employee.teamId) : null;
  const role = employee ? findRoleById(repo, employee.roleId) : null;

  if (!request || !employee || !team || !role) return null;

  const assessment = createAssessmentForRequest({
    repo,
    request,
    teamId: employee.teamId,
    roleId: employee.roleId,
  });

  return {
    request,
    employee,
    team,
    role,
    assessment,
    backupOptions: backupOptionsFor({ repo, request, employee, team, role }),
  };
}

export function buildRequestDetailPageModel(
  repo: DemoRepo,
  requestId: string,
  searchParams: Record<string, string | string[] | undefined>,
): RequestDetailPageModel {
  const reviewQuery = readReviewFilterQuery(searchParams);

  return {
    requestId,
    reviewQuery,
    previewState: getDetailPreviewState(firstSearchParam(searchParams.state)),
    queueHref: buildReviewHref("/requests", reviewQuery),
    reviewContext: reviewContextFor(reviewQuery),
    detail: loadRequestDetail(repo, requestId),
  };
}
