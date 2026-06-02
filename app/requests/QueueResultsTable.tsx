"use client";

import Link from "next/link";

import { useBrowserDecision } from "../_components/BrowserDecisionProvider";
import {
  DecisionBadge,
  RecommendationBadge,
  RiskBadge,
} from "../_components/StatusBadges";

import type { DemoRecommendation } from "../../src/demo/dataset";
import { parseIsoDate, type IsoDate } from "../../src/domain/dates";
import type { QueueItem } from "../../src/domain/ptoQueue/queueService";

export type QueueTableRow = QueueItem & {
  detailHref: string;
};

function formatShortDay(iso: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(iso));
}

function QueueRow({ item }: { item: QueueTableRow }) {
  const { decision } = useBrowserDecision(item.id);

  return (
    <tr className="align-top">
      <th scope="row" className="px-4 py-4 text-left">
        <div className="font-medium text-zinc-950 dark:text-zinc-50">
          <Link
            href={item.detailHref}
            className="underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            {item.employee.displayName}{" "}
            <span className="text-zinc-500 dark:text-zinc-400">
              ({item.id})
            </span>
          </Link>
        </div>
        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Type: {item.requestType.toUpperCase()} · Status: {item.status}
        </div>
      </th>
      <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
        {item.requestedStartDate === item.requestedEndDate
          ? formatShortDay(item.requestedStartDate)
          : `${formatShortDay(item.requestedStartDate)} to ${formatShortDay(item.requestedEndDate)}`}
      </td>
      <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
        {item.team.name}
      </td>
      <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
        {item.role.name}
      </td>
      <td className="px-4 py-4">
        <RiskBadge band={item.assessment.band} score={item.assessment.score} />
      </td>
      <td className="px-4 py-4">
        <RecommendationBadge
          recommendation={item.assessment.recommendation as DemoRecommendation}
        />
      </td>
      <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
        {item.assessment.topReason.summary}
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Conflicts: {item.assessment.conflictLevel}
        </div>
      </td>
      <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          Simulated decision
        </div>
        <div className="mt-1">
          <DecisionBadge decision={decision} />
        </div>
      </td>
    </tr>
  );
}

export function QueueResultsTable({ items }: { items: QueueTableRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">PTO request queue results</caption>
        <thead className="bg-zinc-50 text-xs text-zinc-600 dark:bg-zinc-950/40 dark:text-zinc-400">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Request
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Dates
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Team
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Role
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Risk
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Recommendation
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Top reason
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Demo status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((item) => (
            <QueueRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
