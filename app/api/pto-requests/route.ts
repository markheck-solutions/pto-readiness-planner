import { NextResponse } from "next/server";

import { jsonError, methodNotAllowed } from "../../../src/api/safeError";
import { isIsoDate, type IsoDate } from "../../../src/domain/dates";
import { getDemoRepo } from "../../../src/repos/demoRepo";
import {
  buildQueue,
  type QueueFilters,
  type QueueSortDir,
  queueSortKeys,
  sortQueueItems,
} from "../../../src/domain/ptoQueue/queueService";
import type {
  DemoCoverageBand,
  DemoRequestStatus,
  DemoRequestType,
} from "../../../src/demo/dataset";

function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return fallback;
}

function parseDatePreset(
  preset: string,
  bounds: { startDate: IsoDate; endDate: IsoDate },
): { startDate: IsoDate; endDate: IsoDate } | null {
  if (preset === "next-8-weeks") return bounds;
  if (preset === "next-12-weeks") return bounds;
  return null;
}

function asOneOf<T extends readonly string[]>(
  value: string | null,
  allowed: T,
): T[number] | null {
  if (!value) return null;
  return (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : null;
}

type QueueQuery = {
  filters: QueueFilters;
  sort: (typeof queueSortKeys)[number];
  dir: QueueSortDir;
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: Response };

function parseEnumParam<T extends readonly string[]>(
  url: URL,
  key: string,
  allowed: T,
  message: string,
): ParseResult<T[number] | null> {
  const value = asOneOf(url.searchParams.get(key), allowed);
  if (url.searchParams.has(key) && !value) {
    return {
      ok: false,
      response: jsonError(400, "invalid_request", message, {
        allowed: [...allowed],
      }),
    };
  }
  return { ok: true, value };
}

function parseEntityFilters(
  url: URL,
  repo: ReturnType<typeof getDemoRepo>,
): ParseResult<Pick<QueueFilters, "teamId" | "roleId">> {
  const teamId = url.searchParams.get("teamId") ?? undefined;
  const roleId = url.searchParams.get("roleId") ?? undefined;
  if (teamId && !repo.teams.some((t) => t.id === teamId)) {
    return {
      ok: false,
      response: jsonError(400, "invalid_request", "Unknown teamId.", {
        teamId,
      }),
    };
  }
  if (roleId && !repo.roles.some((r) => r.id === roleId)) {
    return {
      ok: false,
      response: jsonError(400, "invalid_request", "Unknown roleId.", {
        roleId,
      }),
    };
  }

  return { ok: true, value: { teamId, roleId } };
}

function parseCategoricalFilters(
  url: URL,
): ParseResult<
  Pick<
    QueueFilters,
    "requestType" | "status" | "coverageBand" | "conflictLevel"
  >
> {
  const requestType = parseEnumParam(
    url,
    "requestType",
    ["pto", "training"] as const,
    "Invalid requestType.",
  );
  if (!requestType.ok) return requestType;

  const status = parseEnumParam(
    url,
    "status",
    ["pending", "approved", "withdrawn"] as const,
    "Invalid status.",
  );
  if (!status.ok) return status;

  const coverageBand = parseEnumParam(
    url,
    "coverageBand",
    ["healthy", "thin", "risky", "critical"] as const,
    "Invalid coverageBand.",
  );
  if (!coverageBand.ok) return coverageBand;

  const conflictLevel = parseEnumParam(
    url,
    "conflictLevel",
    ["none", "low", "medium", "high"] as const,
    "Invalid conflictLevel.",
  );
  if (!conflictLevel.ok) return conflictLevel;

  return {
    ok: true,
    value: {
      requestType: (requestType.value ?? undefined) as
        | DemoRequestType
        | undefined,
      status: (status.value ?? undefined) as DemoRequestStatus | undefined,
      coverageBand: (coverageBand.value ?? undefined) as
        | DemoCoverageBand
        | undefined,
      conflictLevel: conflictLevel.value ?? undefined,
    },
  };
}

function parseExplicitDateRange(
  startDateRaw: string | null,
  endDateRaw: string | null,
): ParseResult<Pick<QueueFilters, "startDate" | "endDate">> {
  if (!startDateRaw || !endDateRaw) {
    return {
      ok: false,
      response: jsonError(
        400,
        "invalid_request",
        "startDate and endDate must be provided together.",
      ),
    };
  }
  if (!isIsoDate(startDateRaw) || !isIsoDate(endDateRaw)) {
    return {
      ok: false,
      response: jsonError(400, "invalid_request", "Dates must be YYYY-MM-DD."),
    };
  }
  if (startDateRaw > endDateRaw) {
    return {
      ok: false,
      response: jsonError(400, "invalid_request", "Invalid date range.", {
        startDate: startDateRaw,
        endDate: endDateRaw,
      }),
    };
  }
  return { ok: true, value: { startDate: startDateRaw, endDate: endDateRaw } };
}

function parseDateFilters(
  url: URL,
  bounds: { startDate: IsoDate; endDate: IsoDate },
): ParseResult<Pick<QueueFilters, "startDate" | "endDate">> {
  const startDateRaw = url.searchParams.get("startDate");
  const endDateRaw = url.searchParams.get("endDate");
  const rangePreset = url.searchParams.get("range");

  if (rangePreset) {
    const parsed = parseDatePreset(rangePreset, bounds);
    if (!parsed) {
      return {
        ok: false,
        response: jsonError(400, "invalid_request", "Invalid range preset.", {
          allowed: ["next-8-weeks", "next-12-weeks"],
        }),
      };
    }
    return { ok: true, value: parsed };
  }

  if (startDateRaw || endDateRaw) {
    return parseExplicitDateRange(startDateRaw, endDateRaw);
  }

  return { ok: true, value: {} };
}

function parseSortKey(url: URL): ParseResult<(typeof queueSortKeys)[number]> {
  const sortRaw = url.searchParams.get("sort") ?? "risk";
  const sort: (typeof queueSortKeys)[number] | null = queueSortKeys.includes(
    sortRaw as (typeof queueSortKeys)[number],
  )
    ? (sortRaw as (typeof queueSortKeys)[number])
    : null;
  if (url.searchParams.has("sort") && !sort) {
    return {
      ok: false,
      response: jsonError(400, "invalid_request", "Invalid sort.", {
        allowed: [...queueSortKeys],
      }),
    };
  }
  return { ok: true, value: sort ?? "risk" };
}

function parseSortDir(url: URL): ParseResult<QueueSortDir> {
  const dirRaw = (url.searchParams.get("dir") ?? "desc").toLowerCase();
  const dir: QueueSortDir | null =
    dirRaw === "asc" || dirRaw === "desc" ? dirRaw : null;
  if (url.searchParams.has("dir") && !dir) {
    return {
      ok: false,
      response: jsonError(400, "invalid_request", "Invalid dir.", {
        allowed: ["asc", "desc"],
      }),
    };
  }
  return { ok: true, value: dir ?? "desc" };
}

function parseQueueQuery(
  request: Request,
  repo: ReturnType<typeof getDemoRepo>,
): ParseResult<QueueQuery> {
  const url = new URL(request.url);
  const entityFilters = parseEntityFilters(url, repo);
  if (!entityFilters.ok) return entityFilters;
  const categoricalFilters = parseCategoricalFilters(url);
  if (!categoricalFilters.ok) return categoricalFilters;
  const dateFilters = parseDateFilters(url, repo.meta.dateBounds);
  if (!dateFilters.ok) return dateFilters;
  const sort = parseSortKey(url);
  if (!sort.ok) return sort;
  const dir = parseSortDir(url);
  if (!dir.ok) return dir;

  return {
    ok: true,
    value: {
      filters: {
        ...entityFilters.value,
        ...categoricalFilters.value,
        ...dateFilters.value,
      },
      sort: sort.value,
      dir: dir.value,
    },
  };
}

export async function GET(request: Request) {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);
  const repo = getDemoRepo();
  const parsed = parseQueueQuery(request, repo);
  if (!parsed.ok) return parsed.response;

  const result = buildQueue({ repo, filters: parsed.value.filters });

  const items = sortQueueItems(
    result.items,
    parsed.value.sort,
    parsed.value.dir,
  );

  return NextResponse.json(
    {
      demoMode,
      datasetVersion: repo.meta.datasetVersion,
      seedFingerprint: repo.meta.seedFingerprint,
      meta: {
        ...result.meta,
        sort: parsed.value.sort,
        dir: parsed.value.dir,
      },
      items,
    },
    { status: 200 },
  );
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
export async function PUT() {
  return methodNotAllowed(["GET"]);
}
export async function PATCH() {
  return methodNotAllowed(["GET"]);
}
export async function DELETE() {
  return methodNotAllowed(["GET"]);
}
