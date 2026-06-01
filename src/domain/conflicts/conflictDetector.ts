import type { DemoRepo } from "../../repos/demoRepo";
import type { IsoDate } from "../dates";
import { diffDaysIsoDate } from "../dates";

export type ConflictLevel = "none" | "low" | "medium" | "high";

export type ConflictItem =
  | {
      kind: "overlapping_absence";
      absenceId: string;
      employeeId: string;
      employeeDisplayName: string;
      roleId: string;
      roleName: string;
      startDate: IsoDate;
      endDate: IsoDate;
      note: string;
    }
  | {
      kind: "overlapping_request";
      requestId: string;
      employeeId: string;
      employeeDisplayName: string;
      roleId: string;
      roleName: string;
      startDate: IsoDate;
      endDate: IsoDate;
      status: string;
    }
  | {
      kind: "critical_window";
      windowId: string;
      windowKind: string;
      title: string;
      startDate: IsoDate;
      endDate: IsoDate;
      description: string;
    }
  | {
      kind: "short_notice";
      leadDays: number;
      note: string;
    };

export type ConflictAssessment = {
  level: ConflictLevel;
  items: ConflictItem[];
};

function overlaps(
  a: { start: IsoDate; end: IsoDate },
  b: { start: IsoDate; end: IsoDate },
): boolean {
  return !(a.end < b.start || b.end < a.start);
}

function maxConflictLevel(levels: ConflictLevel[]): ConflictLevel {
  const order: Record<ConflictLevel, number> = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3,
  };
  return levels.reduce((acc, v) => (order[v] > order[acc] ? v : acc), "none");
}

export function detectConflictsForRequest(args: {
  repo: DemoRepo;
  requestId: string;
  teamId: string;
  roleId: string;
  range: { start: IsoDate; end: IsoDate };
  submittedAtIso: string;
}): ConflictAssessment {
  const { repo, requestId, teamId, roleId, range, submittedAtIso } = args;

  const items: ConflictItem[] = [];
  const levels: ConflictLevel[] = ["none"];

  for (const w of repo.criticalWindows) {
    if (w.teamId !== teamId) continue;
    if (
      overlaps(range, {
        start: w.startDate,
        end: w.endDate,
      })
    ) {
      items.push({
        kind: "critical_window",
        windowId: w.id,
        windowKind: w.kind,
        title: w.title,
        startDate: w.startDate,
        endDate: w.endDate,
        description: w.description,
      });
      levels.push(w.kind === "blackout" ? "high" : "medium");
    }
  }

  const roleName = repo.roles.find((r) => r.id === roleId)?.name ?? roleId;

  for (const a of repo.existingAbsences) {
    const emp = repo.employees.find((e) => e.id === a.employeeId);
    if (!emp) continue;
    if (emp.teamId !== teamId) continue;
    if (emp.roleId !== roleId) continue;
    if (!overlaps(range, { start: a.startDate, end: a.endDate })) continue;

    items.push({
      kind: "overlapping_absence",
      absenceId: a.id,
      employeeId: emp.id,
      employeeDisplayName: emp.displayName,
      roleId,
      roleName,
      startDate: a.startDate,
      endDate: a.endDate,
      note: a.note,
    });
    levels.push("high");
  }

  for (const r of repo.ptoRequests) {
    if (r.id === requestId) continue;
    const emp = repo.employees.find((e) => e.id === r.employeeId);
    if (!emp) continue;
    if (emp.teamId !== teamId) continue;
    if (emp.roleId !== roleId) continue;
    if (
      !overlaps(range, {
        start: r.requestedStartDate,
        end: r.requestedEndDate,
      })
    )
      continue;

    items.push({
      kind: "overlapping_request",
      requestId: r.id,
      employeeId: emp.id,
      employeeDisplayName: emp.displayName,
      roleId,
      roleName,
      startDate: r.requestedStartDate,
      endDate: r.requestedEndDate,
      status: r.status,
    });
    levels.push(r.status === "approved" ? "high" : "medium");
  }

  // Lead time between submission and requested start. Keep it as a soft manager-signal.
  const submittedDate = submittedAtIso.slice(0, 10) as IsoDate;
  const leadDays = diffDaysIsoDate(submittedDate, range.start);
  if (leadDays >= 0 && leadDays < 7) {
    items.push({
      kind: "short_notice",
      leadDays,
      note: "Short notice can make coverage handoffs harder to staff.",
    });
    levels.push("low");
  }

  return {
    level: maxConflictLevel(levels),
    items,
  };
}
