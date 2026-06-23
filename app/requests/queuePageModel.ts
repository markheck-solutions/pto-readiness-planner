import { isIsoDate, type IsoDate } from "../../src/domain/dates";
import {
  buildQueue,
  queueSortKeys,
  sortQueueItems,
  type QueueFilters,
  type QueueSortDir,
} from "../../src/domain/ptoQueue/queueService";
import {
  buildReviewHref,
  writeReviewFilterQuery,
  type ReviewFilterQuery,
} from "../../src/domain/reviewFilters";
import type {
  DemoCoverageBand,
  DemoRequestStatus,
  DemoRequestType,
} from "../../src/demo/dataset";
import {
  findRoleById,
  findTeamById,
  type DemoRepo,
} from "../../src/repos/demoRepo";
import { type QueueTableRow } from "./QueueResultsTable";

export type ActiveQueueFilter = {
  label: string;
  key: string;
};

export type QueuePageModel = {
  reviewQuery: ReviewFilterQuery;
  teamIdRaw?: string;
  roleIdRaw?: string;
  requestTypeRaw?: string;
  statusRaw?: string;
  coverageBandRaw?: string;
  conflictLevelRaw?: string;
  startDateRaw?: string;
  endDateRaw?: string;
  sortKeyRaw: string;
  sortDirRaw: string;
  heatmapWeekStart?: IsoDate;
  errors: string[];
  baseQuery: ReviewFilterQuery;
  baseParams: URLSearchParams;
  activeFilters: ActiveQueueFilter[];
  queueControlsKey: string;
  rows: QueueTableRow[];
};

type ParsedEntityFilters = {
  filters: Pick<QueueFilters, "teamId" | "roleId">;
  errors: string[];
  labels: Pick<ActiveQueueFilter, "label">[];
};

type ParsedCategoricalFilters = {
  filters: Pick<
    QueueFilters,
    "requestType" | "status" | "coverageBand" | "conflictLevel"
  >;
  errors: string[];
};

type ParsedDateFilters = {
  filters: Pick<QueueFilters, "startDate" | "endDate">;
  errors: string[];
};

function selectedTeam(repo: DemoRepo, teamId: string | undefined) {
  if (!teamId) return null;
  return findTeamById(repo, teamId);
}

function selectedRole(repo: DemoRepo, roleId: string | undefined) {
  if (!roleId) return null;
  return findRoleById(repo, roleId);
}

function missingEntityErrors(args: {
  teamId: string | undefined;
  roleId: string | undefined;
  teamFound: boolean;
  roleFound: boolean;
}) {
  const errors: string[] = [];
  if (args.teamId && !args.teamFound) errors.push("Unknown team filter.");
  if (args.roleId && !args.roleFound) errors.push("Unknown role filter.");
  return errors;
}

function entityLabels(args: {
  teamName: string | undefined;
  teamId: string | undefined;
  roleName: string | undefined;
  roleId: string | undefined;
}) {
  return [
    { label: `Team: ${args.teamName ?? args.teamId ?? ""}` },
    { label: `Role: ${args.roleName ?? args.roleId ?? ""}` },
  ];
}

function parseEntityFilters(
  repo: DemoRepo,
  query: ReviewFilterQuery,
): ParsedEntityFilters {
  const team = selectedTeam(repo, query.teamId);
  const role = selectedRole(repo, query.roleId);

  return {
    filters: {
      teamId: team?.id,
      roleId: role?.id,
    },
    labels: entityLabels({
      teamName: team?.name,
      teamId: query.teamId,
      roleName: role?.name,
      roleId: query.roleId,
    }),
    errors: missingEntityErrors({
      teamId: query.teamId,
      roleId: query.roleId,
      teamFound: team !== null,
      roleFound: role !== null,
    }),
  };
}

function parseOneOf<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  errorMessage: string,
): { value?: T; errors: string[] } {
  if (!raw) return { value: undefined, errors: [] };
  if (allowed.includes(raw as T)) return { value: raw as T, errors: [] };
  return { value: undefined, errors: [errorMessage] };
}

function parseCategoricalFilters(
  query: ReviewFilterQuery,
): ParsedCategoricalFilters {
  const requestType = parseOneOf<DemoRequestType>(
    query.requestType,
    ["pto", "training"],
    "Invalid request type filter.",
  );
  const status = parseOneOf<DemoRequestStatus>(
    query.status,
    ["pending", "approved", "withdrawn"],
    "Invalid status filter.",
  );
  const coverageBand = parseOneOf<DemoCoverageBand>(
    query.coverageBand,
    ["healthy", "thin", "risky", "critical"],
    "Invalid coverage risk filter.",
  );
  const conflictLevel = parseOneOf<QueueFilters["conflictLevel"] & string>(
    query.conflictLevel,
    ["none", "low", "medium", "high"],
    "Invalid conflict level filter.",
  );

  return {
    filters: {
      requestType: requestType.value,
      status: status.value,
      coverageBand: coverageBand.value,
      conflictLevel: conflictLevel.value,
    },
    errors: [
      ...requestType.errors,
      ...status.errors,
      ...coverageBand.errors,
      ...conflictLevel.errors,
    ],
  };
}

function parseDateFilters(query: ReviewFilterQuery): ParsedDateFilters {
  const startDateRaw = query.startDate;
  const endDateRaw = query.endDate;

  if (!startDateRaw && !endDateRaw) {
    return { filters: {}, errors: [] };
  }

  if (!startDateRaw || !endDateRaw) {
    return {
      filters: {},
      errors: ["Start date and end date must be provided together."],
    };
  }

  if (!isIsoDate(startDateRaw) || !isIsoDate(endDateRaw)) {
    return { filters: {}, errors: ["Dates must use YYYY-MM-DD format."] };
  }

  if (startDateRaw > endDateRaw) {
    return {
      filters: {},
      errors: ["Start date must be on or before end date."],
    };
  }

  return {
    filters: { startDate: startDateRaw, endDate: endDateRaw },
    errors: [],
  };
}

function parseSortKey(raw: string): (typeof queueSortKeys)[number] {
  return queueSortKeys.includes(raw as (typeof queueSortKeys)[number])
    ? (raw as (typeof queueSortKeys)[number])
    : "risk";
}

function parseSortDir(raw: string): QueueSortDir {
  return raw === "asc" || raw === "desc" ? raw : "desc";
}

function sortErrors(sortKeyRaw: string, sortDirRaw: string) {
  const errors: string[] = [];
  if (!queueSortKeys.includes(sortKeyRaw as (typeof queueSortKeys)[number])) {
    errors.push("Invalid sort key.");
  }
  if (sortDirRaw !== "asc" && sortDirRaw !== "desc") {
    errors.push("Invalid sort direction.");
  }
  return errors;
}

function validHeatmapWeekStart(raw: string | undefined): IsoDate | undefined {
  return raw && isIsoDate(raw) ? raw : undefined;
}

function queryWithHeatmapWeek(
  query: ReviewFilterQuery,
  heatmapWeekStart: IsoDate | undefined,
): ReviewFilterQuery {
  if (!heatmapWeekStart) return query;
  return { ...query, weekStart: heatmapWeekStart };
}

function queueRows(
  repo: DemoRepo,
  filters: QueueFilters,
  sortKey: (typeof queueSortKeys)[number],
  sortDir: QueueSortDir,
  baseQuery: ReviewFilterQuery,
): QueueTableRow[] {
  const queue = buildQueue({ repo, filters });
  return sortQueueItems(queue.items, sortKey, sortDir).map((item) => ({
    ...item,
    detailHref: buildReviewHref(`/requests/${item.id}`, baseQuery),
  }));
}

function activeFilter(
  rawValue: string | undefined,
  label: string,
  key: string,
): ActiveQueueFilter | null {
  if (!rawValue) return null;
  return { label, key };
}

function activeQueueFilters(args: {
  query: ReviewFilterQuery;
  teamLabel: string;
  roleLabel: string;
}): ActiveQueueFilter[] {
  const { query, teamLabel, roleLabel } = args;
  return [
    activeFilter(query.teamId, teamLabel, "teamId"),
    activeFilter(query.roleId, roleLabel, "roleId"),
    activeFilter(
      query.requestType,
      `Type: ${query.requestType}`,
      "requestType",
    ),
    activeFilter(query.status, `Status: ${query.status}`, "status"),
    activeFilter(
      query.coverageBand,
      `Risk: ${query.coverageBand}`,
      "coverageBand",
    ),
    activeFilter(
      query.conflictLevel,
      `Conflicts: ${query.conflictLevel}`,
      "conflictLevel",
    ),
    activeFilter(
      query.startDate && query.endDate ? query.startDate : undefined,
      `Dates: ${query.startDate} to ${query.endDate}`,
      "dateRange",
    ),
  ].filter((filter): filter is ActiveQueueFilter => filter !== null);
}

function queueControlsKey(model: {
  query: ReviewFilterQuery;
  sortKeyRaw: string;
  sortDirRaw: string;
  heatmapWeekStart?: IsoDate;
}) {
  return [
    model.query.teamId ?? "",
    model.query.roleId ?? "",
    model.query.requestType ?? "",
    model.query.status ?? "",
    model.query.coverageBand ?? "",
    model.query.conflictLevel ?? "",
    model.query.startDate ?? "",
    model.query.endDate ?? "",
    model.sortKeyRaw,
    model.sortDirRaw,
    model.heatmapWeekStart ?? "",
  ].join("|");
}

export function buildQueuePageModel(
  repo: DemoRepo,
  reviewQuery: ReviewFilterQuery,
): QueuePageModel {
  const entity = parseEntityFilters(repo, reviewQuery);
  const categorical = parseCategoricalFilters(reviewQuery);
  const dates = parseDateFilters(reviewQuery);
  const sortKeyRaw = reviewQuery.sort ?? "risk";
  const sortDirRaw = (reviewQuery.dir ?? "desc").toLowerCase();
  const sortKey = parseSortKey(sortKeyRaw);
  const sortDir = parseSortDir(sortDirRaw);
  const heatmapWeekStart = validHeatmapWeekStart(reviewQuery.weekStart);
  const baseQuery = queryWithHeatmapWeek(reviewQuery, heatmapWeekStart);

  return {
    reviewQuery,
    teamIdRaw: reviewQuery.teamId,
    roleIdRaw: reviewQuery.roleId,
    requestTypeRaw: reviewQuery.requestType,
    statusRaw: reviewQuery.status,
    coverageBandRaw: reviewQuery.coverageBand,
    conflictLevelRaw: reviewQuery.conflictLevel,
    startDateRaw: reviewQuery.startDate,
    endDateRaw: reviewQuery.endDate,
    sortKeyRaw,
    sortDirRaw,
    heatmapWeekStart,
    errors: [
      ...entity.errors,
      ...categorical.errors,
      ...dates.errors,
      ...sortErrors(sortKeyRaw, sortDirRaw),
    ],
    baseQuery,
    baseParams: writeReviewFilterQuery(baseQuery),
    activeFilters: activeQueueFilters({
      query: reviewQuery,
      teamLabel: entity.labels[0].label,
      roleLabel: entity.labels[1].label,
    }),
    queueControlsKey: queueControlsKey({
      query: reviewQuery,
      sortKeyRaw,
      sortDirRaw,
      heatmapWeekStart,
    }),
    rows: queueRows(
      repo,
      {
        ...entity.filters,
        ...categorical.filters,
        ...dates.filters,
      },
      sortKey,
      sortDir,
      baseQuery,
    ),
  };
}
