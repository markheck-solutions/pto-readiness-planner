import type { DemoFairnessHistory } from "../../demo/dataset";
import type { DemoRepo } from "../../repos/demoRepo";
import type { IsoDate } from "../dates";
import { diffDaysIsoDate } from "../dates";

export type FairnessSignal = {
  kind:
    | "recent_approvals"
    | "peak_window_rotation"
    | "lead_time_pattern"
    | "context_note";
  message: string;
};

export type FairnessAssessment = {
  note: string;
  signals: FairnessSignal[];
  evidence: { fairnessHistoryId: string | null };
};

export function analyzeFairness(args: {
  repo: DemoRepo;
  employeeId: string;
  requestSubmittedAtIso: string;
  requestStartDate: IsoDate;
}): FairnessAssessment {
  const { repo, employeeId, requestSubmittedAtIso, requestStartDate } = args;

  const record =
    repo.fairnessHistory.find((f) => f.employeeId === employeeId) ?? null;

  const signals: FairnessSignal[] = [];

  if (!record) {
    return {
      note: "Balance signals are not available for this request in the demo dataset.",
      signals: [],
      evidence: { fairnessHistoryId: null },
    };
  }

  const leadDays = diffDaysIsoDate(
    requestSubmittedAtIso.slice(0, 10) as IsoDate,
    requestStartDate,
  );

  signals.push({
    kind: "recent_approvals",
    message: `Balance: ${record.recentApprovedTimeOffCount} approved time off item(s) recently in this demo set.`,
  });

  signals.push({
    kind: "peak_window_rotation",
    message: `Rotation: covered ${record.recentPeakWindowCoverageCount} peak-window shift(s) recently in this demo set.`,
  });

  signals.push({
    kind: "lead_time_pattern",
    message: `Notice: typical notice is about ${record.typicalNoticeDays} day(s); this request was submitted with ${Math.max(
      0,
      leadDays,
    )} day(s) lead time.`,
  });

  signals.push({
    kind: "context_note",
    message: `Context: ${record.note}`,
  });

  return {
    note: "These balance signals are advisory context only. They do not decide the outcome.",
    signals,
    evidence: { fairnessHistoryId: record.id },
  };
}

export function getFairnessHistoryRecord(
  repo: DemoRepo,
  employeeId: string,
): DemoFairnessHistory | null {
  return repo.fairnessHistory.find((f) => f.employeeId === employeeId) ?? null;
}
