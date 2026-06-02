import type { DemoCoverageBand, DemoRecommendation } from "../demo/dataset";
import { parseIsoDate, type IsoDate } from "./dates";

export type DemoDecision = "none" | "approve" | "defer" | "ask_for_coverage";

export type SimulationDraftContext = {
  title: string;
  summary: string;
  callouts: string[];
};

type SimulationDraftContextInput = {
  decision: DemoDecision;
  employeeName: string;
  teamName: string;
  roleName: string;
  requestedStartDate: IsoDate;
  requestedEndDate: IsoDate;
  band: DemoCoverageBand;
  recommendation: DemoRecommendation;
  topReason: string;
  conflictCount: number;
  availableBackupCount: number;
};

function formatShortDay(iso: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(iso));
}

function formatDateRange(start: IsoDate, end: IsoDate): string {
  if (start === end) return formatShortDay(start);
  return `${formatShortDay(start)} to ${formatShortDay(end)}`;
}

function bandLabel(band: DemoCoverageBand): string {
  if (band === "critical") return "Critical";
  if (band === "risky") return "Risky";
  if (band === "thin") return "Thin";
  return "Healthy";
}

function recommendationLabel(recommendation: DemoRecommendation): string {
  if (recommendation === "approve") return "Approve";
  if (recommendation === "approve_with_coverage_actions")
    return "Approve with coverage actions";
  if (recommendation === "needs_discussion") return "Needs discussion";
  return "Defer";
}

function backupCallout(count: number): string {
  if (count === 0) {
    return "No ready same-role backup is visible in the current demo window.";
  }

  return `${count} ready backup${count === 1 ? "" : "s"} can be referenced in the staged draft context.`;
}

export function decisionLabel(decision: DemoDecision): string {
  if (decision === "approve") return "Approved in demo";
  if (decision === "defer") return "Deferred in demo";
  if (decision === "ask_for_coverage") return "Ask for coverage in demo";
  return "No simulated decision";
}

export function decisionActionLabel(decision: DemoDecision): string | null {
  if (decision === "approve") return "Approve";
  if (decision === "defer") return "Defer";
  if (decision === "ask_for_coverage") return "Ask for coverage";
  return null;
}

export function matchesDecisionFilter(
  decision: DemoDecision,
  filter: DemoDecision | null,
): boolean {
  if (filter === null) return true;
  return decision === filter;
}

export function buildSimulationDraftContext({
  decision,
  employeeName,
  teamName,
  roleName,
  requestedStartDate,
  requestedEndDate,
  band,
  recommendation,
  topReason,
  conflictCount,
  availableBackupCount,
}: SimulationDraftContextInput): SimulationDraftContext {
  const requestLine = `${employeeName} · ${roleName}, ${teamName} · ${formatDateRange(
    requestedStartDate,
    requestedEndDate,
  )}`;
  const recommendationLine = `Current risk view: ${bandLabel(band)} coverage pressure with ${recommendationLabel(recommendation).toLowerCase()} guidance.`;

  if (decision === "approve") {
    return {
      title: "Draft context staged for demo approval",
      summary:
        "The draft should confirm the request window, note the current coverage posture, and stay clear that the demo action is not saved or sent.",
      callouts: [
        requestLine,
        `Top reason to acknowledge: ${topReason}`,
        backupCallout(availableBackupCount),
      ],
    };
  }

  if (decision === "defer") {
    return {
      title: "Draft context staged for demo defer",
      summary:
        "The draft should explain the blocking coverage or timing risk, set a follow-up checkpoint, and avoid implying a saved decision.",
      callouts: [
        requestLine,
        `Blocking signal: ${topReason}`,
        `${conflictCount} current conflict${conflictCount === 1 ? "" : "s"} are active in this request window.`,
      ],
    };
  }

  if (decision === "ask_for_coverage") {
    return {
      title: "Draft context staged for coverage follow-up",
      summary:
        "The draft should ask for specific backup coverage confirmation tied to the selected role and dates, without requesting sensitive HR details.",
      callouts: [
        requestLine,
        `Ask for coverage confirmation for the ${roleName} handoff during ${formatDateRange(
          requestedStartDate,
          requestedEndDate,
        )}.`,
        backupCallout(availableBackupCount),
      ],
    };
  }

  return {
    title: "Draft context is waiting for a demo action",
    summary:
      "Choose Approve, Defer, or Ask for coverage to stage the response context for this request. The draft remains session-only and nothing is sent or saved.",
    callouts: [requestLine, recommendationLine, `Top reason: ${topReason}`],
  };
}
