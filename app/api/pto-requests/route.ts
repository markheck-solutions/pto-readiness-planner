import { NextResponse } from "next/server";

import { jsonError, methodNotAllowed } from "../../../src/api/safeError";
import { isIsoDate, type IsoDate } from "../../../src/domain/dates";
import { getDemoRepo } from "../../../src/repos/demoRepo";
import {
  buildQueue,
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

export async function GET(request: Request) {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);
  const repo = getDemoRepo();

  const url = new URL(request.url);

  const teamId = url.searchParams.get("teamId") ?? undefined;
  const roleId = url.searchParams.get("roleId") ?? undefined;

  const requestType = asOneOf(url.searchParams.get("requestType"), [
    "pto",
    "training",
  ] as const) as DemoRequestType | null;
  if (url.searchParams.has("requestType") && !requestType) {
    return jsonError(400, "invalid_request", "Invalid requestType.", {
      allowed: ["pto", "training"],
    });
  }

  const status = asOneOf(url.searchParams.get("status"), [
    "pending",
    "approved",
    "withdrawn",
  ] as const) as DemoRequestStatus | null;
  if (url.searchParams.has("status") && !status) {
    return jsonError(400, "invalid_request", "Invalid status.", {
      allowed: ["pending", "approved", "withdrawn"],
    });
  }

  const coverageBand = asOneOf(url.searchParams.get("coverageBand"), [
    "healthy",
    "thin",
    "risky",
    "critical",
  ] as const) as DemoCoverageBand | null;
  if (url.searchParams.has("coverageBand") && !coverageBand) {
    return jsonError(400, "invalid_request", "Invalid coverageBand.", {
      allowed: ["healthy", "thin", "risky", "critical"],
    });
  }

  const conflictLevel = asOneOf(url.searchParams.get("conflictLevel"), [
    "none",
    "low",
    "medium",
    "high",
  ] as const);
  if (url.searchParams.has("conflictLevel") && !conflictLevel) {
    return jsonError(400, "invalid_request", "Invalid conflictLevel.", {
      allowed: ["none", "low", "medium", "high"],
    });
  }

  if (teamId && !repo.teams.some((t) => t.id === teamId)) {
    return jsonError(400, "invalid_request", "Unknown teamId.", { teamId });
  }
  if (roleId && !repo.roles.some((r) => r.id === roleId)) {
    return jsonError(400, "invalid_request", "Unknown roleId.", { roleId });
  }

  const startDateRaw = url.searchParams.get("startDate");
  const endDateRaw = url.searchParams.get("endDate");
  const rangePreset = url.searchParams.get("range");

  let startDate: IsoDate | undefined;
  let endDate: IsoDate | undefined;

  if (rangePreset) {
    const parsed = parseDatePreset(rangePreset, repo.meta.dateBounds);
    if (!parsed) {
      return jsonError(400, "invalid_request", "Invalid range preset.", {
        allowed: ["next-8-weeks", "next-12-weeks"],
      });
    }
    startDate = parsed.startDate;
    endDate = parsed.endDate;
  }

  if (startDateRaw || endDateRaw) {
    if (!startDateRaw || !endDateRaw) {
      return jsonError(
        400,
        "invalid_request",
        "startDate and endDate must be provided together.",
      );
    }
    if (!isIsoDate(startDateRaw) || !isIsoDate(endDateRaw)) {
      return jsonError(400, "invalid_request", "Dates must be YYYY-MM-DD.");
    }
    if (startDateRaw > endDateRaw) {
      return jsonError(400, "invalid_request", "Invalid date range.", {
        startDate: startDateRaw,
        endDate: endDateRaw,
      });
    }
    startDate = startDateRaw;
    endDate = endDateRaw;
  }

  const sortRaw = url.searchParams.get("sort") ?? "risk";
  const sort: (typeof queueSortKeys)[number] | null = queueSortKeys.includes(
    sortRaw as (typeof queueSortKeys)[number],
  )
    ? (sortRaw as (typeof queueSortKeys)[number])
    : null;
  if (url.searchParams.has("sort") && !sort) {
    return jsonError(400, "invalid_request", "Invalid sort.", {
      allowed: [...queueSortKeys],
    });
  }

  const dirRaw = (url.searchParams.get("dir") ?? "desc").toLowerCase();
  const dir: "asc" | "desc" | null =
    dirRaw === "asc" || dirRaw === "desc" ? dirRaw : null;
  if (url.searchParams.has("dir") && !dir) {
    return jsonError(400, "invalid_request", "Invalid dir.", {
      allowed: ["asc", "desc"],
    });
  }

  const result = buildQueue({
    repo,
    filters: {
      teamId,
      roleId,
      requestType: requestType ?? undefined,
      status: status ?? undefined,
      coverageBand: coverageBand ?? undefined,
      conflictLevel: (conflictLevel ?? undefined) as
        | "none"
        | "low"
        | "medium"
        | "high"
        | undefined,
      startDate,
      endDate,
    },
  });

  const items = sortQueueItems(result.items, sort ?? "risk", dir ?? "desc");

  return NextResponse.json(
    {
      demoMode,
      datasetVersion: repo.meta.datasetVersion,
      seedFingerprint: repo.meta.seedFingerprint,
      meta: {
        ...result.meta,
        sort: sort ?? "risk",
        dir: dir ?? "desc",
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
