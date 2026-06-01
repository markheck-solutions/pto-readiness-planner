import type { DemoRepo } from "../../repos/demoRepo";
import type { IsoDate } from "../dates";
import { eachDayInclusive } from "../dates";

export type CoverageComparison = "above" | "exact" | "below";

export type CoverageByDay = {
  date: IsoDate;
  required: number;
  available: number;
  comparison: CoverageComparison;
};

export type CoverageAssessment = {
  teamId: string;
  roleId: string;
  range: { start: IsoDate; end: IsoDate };
  required: number;
  minAvailable: number;
  comparison: CoverageComparison;
  singlePersonRole: boolean;
  singlePersonExposure: boolean;
  days: CoverageByDay[];
  evidence: {
    requirementId: string | null;
    affectedEmployeeIds: string[];
  };
};

function comparison(required: number, available: number): CoverageComparison {
  if (available < required) return "below";
  if (available === required) return "exact";
  return "above";
}

function overlaps(
  a: { start: IsoDate; end: IsoDate },
  b: { start: IsoDate; end: IsoDate },
): boolean {
  return !(a.end < b.start || b.end < a.start);
}

export function calculateCoverageAssessment(args: {
  repo: DemoRepo;
  teamId: string;
  roleId: string;
  range: { start: IsoDate; end: IsoDate };
  includeRequestEmployeeId?: string; // Treat this employee as absent for the range.
}): CoverageAssessment {
  const { repo, teamId, roleId, range, includeRequestEmployeeId } = args;

  const employees = repo.employees.filter(
    (e) => e.teamId === teamId && e.roleId === roleId,
  );
  const requirement =
    repo.coverageRequirements.find(
      (c) => c.teamId === teamId && c.roleId === roleId,
    ) ?? null;

  const required = requirement?.minRequired ?? 0;
  const singlePersonRole = employees.length === 1;

  const absentAcrossRange = new Set<string>();

  const days = eachDayInclusive(range.start, range.end).map((date) => {
    const dayRange = { start: date, end: date };

    const absentEmployeeIds = new Set<string>();

    for (const a of repo.existingAbsences) {
      if (!employees.some((e) => e.id === a.employeeId)) continue;
      if (overlaps(dayRange, { start: a.startDate, end: a.endDate })) {
        absentEmployeeIds.add(a.employeeId);
      }
    }

    for (const r of repo.ptoRequests) {
      if (r.status !== "approved") continue;
      if (!employees.some((e) => e.id === r.employeeId)) continue;
      if (
        overlaps(dayRange, {
          start: r.requestedStartDate,
          end: r.requestedEndDate,
        })
      ) {
        absentEmployeeIds.add(r.employeeId);
      }
    }

    if (includeRequestEmployeeId) {
      absentEmployeeIds.add(includeRequestEmployeeId);
    }

    for (const id of absentEmployeeIds) absentAcrossRange.add(id);

    const available = Math.max(0, employees.length - absentEmployeeIds.size);
    return {
      date,
      required,
      available,
      comparison: comparison(required, available),
    };
  });

  const minAvailable = days.reduce(
    (min, d) => Math.min(min, d.available),
    Number.POSITIVE_INFINITY,
  );

  const worst = days.reduce<CoverageComparison>((acc, d) => {
    if (d.comparison === "below") return "below";
    if (d.comparison === "exact") return acc === "above" ? "exact" : acc;
    return acc;
  }, "above");

  const singlePersonExposure = singlePersonRole && minAvailable < required;

  return {
    teamId,
    roleId,
    range,
    required,
    minAvailable:
      minAvailable === Number.POSITIVE_INFINITY ? employees.length : minAvailable,
    comparison: worst,
    singlePersonRole,
    singlePersonExposure,
    days,
    evidence: {
      requirementId: requirement?.id ?? null,
      affectedEmployeeIds: Array.from(absentAcrossRange),
    },
  };
}
