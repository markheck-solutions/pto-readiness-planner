import Link from "next/link";

import { DemoNotice } from "../_components/DemoNotice";
import { QueueResultsTable, type QueueTableRow } from "./QueueResultsTable";

import { isIsoDate, type IsoDate } from "../../src/domain/dates";
import { buildQueue, type QueueItem } from "../../src/domain/ptoQueue/queueService";
import type {
  DemoCoverageBand,
  DemoRequestStatus,
  DemoRequestType,
} from "../../src/demo/dataset";
import {
  findRoleById,
  findTeamById,
  getDemoRepo,
} from "../../src/repos/demoRepo";

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function conflictRank(level: QueueItem["assessment"]["conflictLevel"]): number {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  if (level === "low") return 1;
  return 0;
}

function recommendationRank(rec: QueueItem["assessment"]["recommendation"]): number {
  if (rec === "defer") return 3;
  if (rec === "needs_discussion") return 2;
  if (rec === "approve_with_coverage_actions") return 1;
  return 0;
}

function sortItems(
  items: QueueItem[],
  key: string,
  dir: "asc" | "desc",
): QueueItem[] {
  const direction = dir === "asc" ? 1 : -1;
  return items.slice().sort((a, b) => {
    if (key === "start_date") {
      if (a.requestedStartDate !== b.requestedStartDate)
        return (
          direction *
          (a.requestedStartDate < b.requestedStartDate ? -1 : 1)
        );
      if (a.id !== b.id) return a.id < b.id ? -1 : 1;
      return 0;
    }
    if (key === "recommendation") {
      const delta =
        recommendationRank(a.assessment.recommendation) -
        recommendationRank(b.assessment.recommendation);
      if (delta !== 0) return direction * delta;
      if (a.assessment.score !== b.assessment.score)
        return direction * (a.assessment.score - b.assessment.score);
      return a.id < b.id ? -1 : 1;
    }
    if (key === "conflict") {
      const delta = conflictRank(a.assessment.conflictLevel) - conflictRank(b.assessment.conflictLevel);
      if (delta !== 0) return direction * delta;
      if (a.assessment.score !== b.assessment.score)
        return direction * (a.assessment.score - b.assessment.score);
      return a.id < b.id ? -1 : 1;
    }
    // Default: risk score.
    if (a.assessment.score !== b.assessment.score)
      return direction * (a.assessment.score - b.assessment.score);
    if (a.requestedStartDate !== b.requestedStartDate)
      return (
        direction *
        (a.requestedStartDate < b.requestedStartDate ? -1 : 1)
      );
    return a.id < b.id ? -1 : 1;
  });
}

function buildSearchParamsHref(
  pathname: string,
  params: URLSearchParams,
): string {
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const repo = getDemoRepo();

  const sp = await Promise.resolve(searchParams ?? {});

  const teamIdRaw = asString(sp.teamId);
  const roleIdRaw = asString(sp.roleId);
  const requestTypeRaw = asString(sp.requestType);
  const statusRaw = asString(sp.status);
  const coverageBandRaw = asString(sp.coverageBand);
  const conflictLevelRaw = asString(sp.conflictLevel);

  const startDateRaw = asString(sp.startDate);
  const endDateRaw = asString(sp.endDate);

  const sortKeyRaw = asString(sp.sort) ?? "risk";
  const sortDirRaw = (asString(sp.dir) ?? "desc").toLowerCase();

  const errors: string[] = [];

  const team = teamIdRaw ? findTeamById(repo, teamIdRaw) : null;
  const role = roleIdRaw ? findRoleById(repo, roleIdRaw) : null;

  const teamId = team ? team.id : undefined;
  const roleId = role ? role.id : undefined;
  if (teamIdRaw && !team) errors.push("Unknown team filter.");
  if (roleIdRaw && !role) errors.push("Unknown role filter.");

  const requestTypeAllowed = ["pto", "training"] as const;
  const requestType = requestTypeRaw && requestTypeAllowed.includes(requestTypeRaw as DemoRequestType)
    ? (requestTypeRaw as DemoRequestType)
    : undefined;
  if (requestTypeRaw && !requestType) errors.push("Invalid request type filter.");

  const statusAllowed = ["pending", "approved", "withdrawn"] as const;
  const status = statusRaw && statusAllowed.includes(statusRaw as DemoRequestStatus)
    ? (statusRaw as DemoRequestStatus)
    : undefined;
  if (statusRaw && !status) errors.push("Invalid status filter.");

  const bandAllowed = ["healthy", "thin", "risky", "critical"] as const;
  const coverageBand =
    coverageBandRaw && bandAllowed.includes(coverageBandRaw as DemoCoverageBand)
      ? (coverageBandRaw as DemoCoverageBand)
      : undefined;
  if (coverageBandRaw && !coverageBand) errors.push("Invalid coverage risk filter.");

  const conflictAllowed = ["none", "low", "medium", "high"] as const;
  const conflictLevel =
    conflictLevelRaw &&
    conflictAllowed.includes(
      conflictLevelRaw as QueueItem["assessment"]["conflictLevel"],
    )
      ? (conflictLevelRaw as QueueItem["assessment"]["conflictLevel"])
      : undefined;
  if (conflictLevelRaw && !conflictLevel)
    errors.push("Invalid conflict level filter.");

  let startDate: IsoDate | undefined;
  let endDate: IsoDate | undefined;
  if (startDateRaw || endDateRaw) {
    if (!startDateRaw || !endDateRaw) {
      errors.push("Start date and end date must be provided together.");
    } else if (!isIsoDate(startDateRaw) || !isIsoDate(endDateRaw)) {
      errors.push("Dates must use YYYY-MM-DD format.");
    } else if (startDateRaw > endDateRaw) {
      errors.push("Start date must be on or before end date.");
    } else {
      startDate = startDateRaw;
      endDate = endDateRaw;
    }
  }

  const sortAllowed = ["risk", "start_date", "recommendation", "conflict"] as const;
  const sortKey = sortAllowed.includes(sortKeyRaw as (typeof sortAllowed)[number])
    ? (sortKeyRaw as (typeof sortAllowed)[number])
    : "risk";
  if (sortKeyRaw && !sortAllowed.includes(sortKeyRaw as (typeof sortAllowed)[number]))
    errors.push("Invalid sort key.");

  const sortDir = sortDirRaw === "asc" || sortDirRaw === "desc" ? sortDirRaw : "desc";
  if (sortDirRaw && sortDirRaw !== "asc" && sortDirRaw !== "desc")
    errors.push("Invalid sort direction.");

  const queue = buildQueue({
    repo,
    filters: {
      teamId,
      roleId,
      requestType,
      status,
      coverageBand,
      conflictLevel,
      startDate,
      endDate,
    },
  });

  const items = sortItems(queue.items, sortKey, sortDir);

  const baseParams = new URLSearchParams();
  if (teamIdRaw) baseParams.set("teamId", teamIdRaw);
  if (roleIdRaw) baseParams.set("roleId", roleIdRaw);
  if (requestTypeRaw) baseParams.set("requestType", requestTypeRaw);
  if (statusRaw) baseParams.set("status", statusRaw);
  if (coverageBandRaw) baseParams.set("coverageBand", coverageBandRaw);
  if (conflictLevelRaw) baseParams.set("conflictLevel", conflictLevelRaw);
  if (startDateRaw) baseParams.set("startDate", startDateRaw);
  if (endDateRaw) baseParams.set("endDate", endDateRaw);
  if (sortKeyRaw) baseParams.set("sort", sortKeyRaw);
  if (sortDirRaw) baseParams.set("dir", sortDirRaw);

  const rows: QueueTableRow[] = items.map((item) => {
    const detailParams = new URLSearchParams(baseParams);
    detailParams.delete("sort");
    detailParams.delete("dir");
    return {
      ...item,
      detailHref: buildSearchParamsHref(`/requests/${item.id}`, detailParams),
    };
  });

  const activeFilters: Array<{ label: string; key: string }> = [];
  if (teamIdRaw) activeFilters.push({ label: `Team: ${team?.name ?? teamIdRaw}`, key: "teamId" });
  if (roleIdRaw) activeFilters.push({ label: `Role: ${role?.name ?? roleIdRaw}`, key: "roleId" });
  if (requestTypeRaw) activeFilters.push({ label: `Type: ${requestTypeRaw}`, key: "requestType" });
  if (statusRaw) activeFilters.push({ label: `Status: ${statusRaw}`, key: "status" });
  if (coverageBandRaw) activeFilters.push({ label: `Risk: ${coverageBandRaw}`, key: "coverageBand" });
  if (conflictLevelRaw) activeFilters.push({ label: `Conflicts: ${conflictLevelRaw}`, key: "conflictLevel" });
  if (startDateRaw && endDateRaw)
    activeFilters.push({ label: `Dates: ${startDateRaw} to ${endDateRaw}`, key: "dateRange" });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <div className="max-w-3xl">
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          <Link
            href="/"
            className="underline underline-offset-4 hover:text-zinc-950 dark:hover:text-zinc-50"
          >
            Manager overview
          </Link>{" "}
          <span aria-hidden="true">/</span> PTO request queue
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
          PTO request queue
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          Filter and sort requests to focus manager time on coverage readiness. This is a public
          demo with fictional data only. Actions are simulation only and reset on refresh.
        </p>
      </div>

      <div className="mt-6">
        <DemoNotice compact />
      </div>
      <section aria-label="Queue controls" className="mt-8">
        <form
          method="get"
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
        >
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label
                htmlFor="teamId"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Team
              </label>
              <select
                id="teamId"
                name="teamId"
                defaultValue={teamIdRaw ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
              >
                <option value="">All teams</option>
                {repo.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="roleId"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Role
              </label>
              <select
                id="roleId"
                name="roleId"
                defaultValue={roleIdRaw ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
              >
                <option value="">All roles</option>
                {repo.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="requestType"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Request type
              </label>
              <select
                id="requestType"
                name="requestType"
                defaultValue={requestTypeRaw ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
              >
                <option value="">All</option>
                <option value="pto">PTO</option>
                <option value="training">Training</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="status"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Approval status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={statusRaw ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
              >
                <option value="">Any</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="coverageBand"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Coverage risk
              </label>
              <select
                id="coverageBand"
                name="coverageBand"
                defaultValue={coverageBandRaw ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
              >
                <option value="">Any</option>
                <option value="healthy">Healthy</option>
                <option value="thin">Thin</option>
                <option value="risky">Risky</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="conflictLevel"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Conflict level
              </label>
              <select
                id="conflictLevel"
                name="conflictLevel"
                defaultValue={conflictLevelRaw ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
              >
                <option value="">Any</option>
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="startDate"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Start date
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={startDateRaw ?? ""}
                min={repo.meta.dateBounds.startDate}
                max={repo.meta.dateBounds.endDate}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
              />
            </div>

            <div>
              <label
                htmlFor="endDate"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                End date
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={endDateRaw ?? ""}
                min={repo.meta.dateBounds.startDate}
                max={repo.meta.dateBounds.endDate}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
              />
            </div>

            <div>
              <label
                htmlFor="sort"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Sort by
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={sortKeyRaw}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
              >
                <option value="risk">Risk score</option>
                <option value="start_date">Start date</option>
                <option value="recommendation">Recommendation</option>
                <option value="conflict">Conflict level</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="dir"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Direction
              </label>
              <select
                id="dir"
                name="dir"
                defaultValue={sortDirRaw}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Showing{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
                {items.length}
              </span>{" "}
              request{items.length === 1 ? "" : "s"}.
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/requests"
                className="rounded-full px-3 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
              >
                Clear all
              </Link>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Apply filters
              </button>
            </div>
          </div>

          {errors.length > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="font-medium">Some filters were not applied.</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {activeFilters.length > 0 ? (
            <div className="mt-4">
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Active filters
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeFilters.map((f) => {
                  const next = new URLSearchParams(baseParams);
                  if (f.key === "dateRange") {
                    next.delete("startDate");
                    next.delete("endDate");
                  } else {
                    next.delete(f.key);
                  }
                  return (
                    <Link
                      key={f.label}
                      href={buildSearchParamsHref("/requests", next)}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-zinc-300 dark:hover:bg-zinc-950/30"
                      aria-label={`Remove ${f.label}`}
                    >
                      <span>{f.label}</span>
                      <span aria-hidden="true" className="text-zinc-400">
                        ×
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </form>
      </section>

      <section aria-label="Queue results" className="mt-6">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
            <p className="font-medium text-zinc-950 dark:text-zinc-50">
              No requests match the current filters.
            </p>
            <p className="mt-2">
              Try clearing filters, broadening the date range, or selecting a different team.
            </p>
            <div className="mt-4">
              <Link
                href="/requests"
                className="text-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
              >
                Clear filters and show the full queue
              </Link>
            </div>
          </div>
        ) : (
          <QueueResultsTable items={rows} />
        )}
      </section>
    </div>
  );
}
