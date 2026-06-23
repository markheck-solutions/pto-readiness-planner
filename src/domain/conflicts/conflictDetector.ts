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

type ConflictCollection = {
  items: ConflictItem[];
  levels: ConflictLevel[];
};

function emptyConflictCollection(): ConflictCollection {
  return { items: [], levels: [] };
}

function collectCriticalWindowConflicts(args: {
  repo: DemoRepo;
  teamId: string;
  range: { start: IsoDate; end: IsoDate };
}): ConflictCollection {
  const { repo, teamId, range } = args;
  const result = emptyConflictCollection();

  for (const window of repo.criticalWindows) {
    if (window.teamId !== teamId) continue;
    if (!overlaps(range, { start: window.startDate, end: window.endDate }))
      continue;

    result.items.push({
      kind: "critical_window",
      windowId: window.id,
      windowKind: window.kind,
      title: window.title,
      startDate: window.startDate,
      endDate: window.endDate,
      description: window.description,
    });
    result.levels.push(window.kind === "blackout" ? "high" : "medium");
  }

  return result;
}

function employeeMatchesRole(
  repo: DemoRepo,
  employeeId: string,
  teamId: string,
  roleId: string,
) {
  const employee = repo.employees.find((e) => e.id === employeeId);
  if (!employee) return null;
  if (employee.teamId !== teamId || employee.roleId !== roleId) return null;
  return employee;
}

function roleNameFor(repo: DemoRepo, roleId: string) {
  return repo.roles.find((role) => role.id === roleId)?.name ?? roleId;
}

function collectExistingAbsenceConflicts(args: {
  repo: DemoRepo;
  teamId: string;
  roleId: string;
  range: { start: IsoDate; end: IsoDate };
}): ConflictCollection {
  const { repo, teamId, roleId, range } = args;
  const roleName = roleNameFor(repo, roleId);
  const result = emptyConflictCollection();

  for (const absence of repo.existingAbsences) {
    const employee = employeeMatchesRole(
      repo,
      absence.employeeId,
      teamId,
      roleId,
    );
    if (!employee) continue;
    if (!overlaps(range, { start: absence.startDate, end: absence.endDate }))
      continue;

    result.items.push({
      kind: "overlapping_absence",
      absenceId: absence.id,
      employeeId: employee.id,
      employeeDisplayName: employee.displayName,
      roleId,
      roleName,
      startDate: absence.startDate,
      endDate: absence.endDate,
      note: absence.note,
    });
    result.levels.push("high");
  }

  return result;
}

function collectOverlappingRequestConflicts(args: {
  repo: DemoRepo;
  requestId: string;
  teamId: string;
  roleId: string;
  range: { start: IsoDate; end: IsoDate };
}): ConflictCollection {
  const { repo, requestId, teamId, roleId, range } = args;
  const roleName = roleNameFor(repo, roleId);
  const result = emptyConflictCollection();

  for (const request of repo.ptoRequests) {
    if (request.id === requestId) continue;
    const employee = employeeMatchesRole(
      repo,
      request.employeeId,
      teamId,
      roleId,
    );
    if (!employee) continue;
    if (
      !overlaps(range, {
        start: request.requestedStartDate,
        end: request.requestedEndDate,
      })
    )
      continue;

    result.items.push({
      kind: "overlapping_request",
      requestId: request.id,
      employeeId: employee.id,
      employeeDisplayName: employee.displayName,
      roleId,
      roleName,
      startDate: request.requestedStartDate,
      endDate: request.requestedEndDate,
      status: request.status,
    });
    result.levels.push(request.status === "approved" ? "high" : "medium");
  }

  return result;
}

function collectShortNoticeConflict(
  submittedAtIso: string,
  range: { start: IsoDate; end: IsoDate },
): ConflictCollection {
  const submittedDate = submittedAtIso.slice(0, 10) as IsoDate;
  const leadDays = diffDaysIsoDate(submittedDate, range.start);
  if (leadDays < 0 || leadDays >= 7) return emptyConflictCollection();

  return {
    items: [
      {
        kind: "short_notice",
        leadDays,
        note: "Short notice can make coverage handoffs harder to staff.",
      },
    ],
    levels: ["low"],
  };
}

function combineConflictCollections(
  collections: ConflictCollection[],
): ConflictAssessment {
  const items = collections.flatMap((collection) => collection.items);
  const levels = [
    "none",
    ...collections.flatMap((collection) => collection.levels),
  ];

  return {
    level: maxConflictLevel(levels as ConflictLevel[]),
    items,
  };
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

  return combineConflictCollections([
    collectCriticalWindowConflicts({ repo, teamId, range }),
    collectExistingAbsenceConflicts({ repo, teamId, roleId, range }),
    collectOverlappingRequestConflicts({
      repo,
      requestId,
      teamId,
      roleId,
      range,
    }),
    collectShortNoticeConflict(submittedAtIso, range),
  ]);
}
