import Link from "next/link";
import type { ReactNode } from "react";

import {
  buildReviewHref,
  readReviewFilterQuery,
} from "../../src/domain/reviewFilters";
import type { DemoRepo } from "../../src/repos/demoRepo";
import { ResetQueueFiltersLink } from "./ResetQueueFiltersLink";
import type { ActiveQueueFilter, QueuePageModel } from "./queuePageModel";

function QueueFilterErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div className="font-medium">Some filters were not applied.</div>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

function paramsWithoutFilter(baseParams: URLSearchParams, filterKey: string) {
  const next = new URLSearchParams(baseParams);
  if (filterKey === "dateRange") {
    next.delete("startDate");
    next.delete("endDate");
    return next;
  }
  next.delete(filterKey);
  return next;
}

function ActiveQueueFilters({
  filters,
  baseParams,
}: {
  filters: ActiveQueueFilter[];
  baseParams: URLSearchParams;
}) {
  if (filters.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Active filters
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {filters.map((filter) => {
          const next = paramsWithoutFilter(baseParams, filter.key);
          return (
            <Link
              key={filter.label}
              href={buildReviewHref("/requests", readReviewFilterQuery(next))}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-zinc-300 dark:hover:bg-zinc-950/30"
              aria-label={`Remove ${filter.label}`}
            >
              <span>{filter.label}</span>
              <span aria-hidden="true" className="text-zinc-400">
                ×
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function QueueSelect({
  id,
  label,
  defaultValue,
  children,
}: {
  id: string;
  label: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
      >
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
      >
        {children}
      </select>
    </div>
  );
}

function QueueDateInput({
  id,
  label,
  defaultValue,
  repo,
}: {
  id: "startDate" | "endDate";
  label: string;
  defaultValue: string;
  repo: DemoRepo;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="date"
        defaultValue={defaultValue}
        min={repo.meta.dateBounds.startDate}
        max={repo.meta.dateBounds.endDate}
        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-700"
      />
    </div>
  );
}

function QueueFilterFields({
  repo,
  model,
}: {
  repo: DemoRepo;
  model: QueuePageModel;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <QueueSelect
        id="teamId"
        label="Team"
        defaultValue={model.teamIdRaw ?? ""}
      >
        <option value="">All teams</option>
        {repo.teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </QueueSelect>

      <QueueSelect
        id="roleId"
        label="Role"
        defaultValue={model.roleIdRaw ?? ""}
      >
        <option value="">All roles</option>
        {repo.roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </QueueSelect>

      <QueueSelect
        id="requestType"
        label="Request type"
        defaultValue={model.requestTypeRaw ?? ""}
      >
        <option value="">All</option>
        <option value="pto">PTO</option>
        <option value="training">Training</option>
      </QueueSelect>

      <QueueSelect
        id="status"
        label="Approval status"
        defaultValue={model.statusRaw ?? ""}
      >
        <option value="">Any</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="withdrawn">Withdrawn</option>
      </QueueSelect>

      <QueueSelect
        id="coverageBand"
        label="Coverage risk"
        defaultValue={model.coverageBandRaw ?? ""}
      >
        <option value="">Any</option>
        <option value="healthy">Healthy</option>
        <option value="thin">Thin</option>
        <option value="risky">Risky</option>
        <option value="critical">Critical</option>
      </QueueSelect>

      <QueueSelect
        id="conflictLevel"
        label="Conflict level"
        defaultValue={model.conflictLevelRaw ?? ""}
      >
        <option value="">Any</option>
        <option value="none">None</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </QueueSelect>

      <QueueDateInput
        id="startDate"
        label="Start date"
        defaultValue={model.startDateRaw ?? ""}
        repo={repo}
      />
      <QueueDateInput
        id="endDate"
        label="End date"
        defaultValue={model.endDateRaw ?? ""}
        repo={repo}
      />

      <QueueSelect id="sort" label="Sort by" defaultValue={model.sortKeyRaw}>
        <option value="risk">Risk score</option>
        <option value="start_date">Start date</option>
        <option value="recommendation">Recommendation</option>
        <option value="conflict">Conflict level</option>
      </QueueSelect>

      <QueueSelect id="dir" label="Direction" defaultValue={model.sortDirRaw}>
        <option value="desc">Descending</option>
        <option value="asc">Ascending</option>
      </QueueSelect>
    </div>
  );
}

export function QueueControlsForm({
  repo,
  model,
}: {
  repo: DemoRepo;
  model: QueuePageModel;
}) {
  return (
    <form
      key={model.queueControlsKey}
      method="get"
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      {model.heatmapWeekStart ? (
        <input type="hidden" name="weekStart" value={model.heatmapWeekStart} />
      ) : null}
      <QueueFilterFields repo={repo} model={model} />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ResetQueueFiltersLink
            href="/requests"
            className="rounded-full px-3 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            Clear all
          </ResetQueueFiltersLink>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Apply filters
          </button>
        </div>
      </div>

      <QueueFilterErrors errors={model.errors} />
      <ActiveQueueFilters
        filters={model.activeFilters}
        baseParams={model.baseParams}
      />
    </form>
  );
}
