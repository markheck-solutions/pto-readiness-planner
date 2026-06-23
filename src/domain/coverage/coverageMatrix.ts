import type { DemoRepo } from "../../repos/demoRepo";
import type {
  DemoCoverageRequirement,
  DemoEmployee,
  DemoTeam,
} from "../../demo/dataset";
import type { IsoDate } from "../dates";
import { eachDayInclusive } from "../dates";
import type { CoverageComparison } from "./coverageCalculator";

export type CoverageMatrixRow = {
  teamId: string;
  teamName: string;
  roleId: string;
  roleName: string;
  range: { start: IsoDate; end: IsoDate };
  required: number;
  minAvailable: number;
  comparison: CoverageComparison;
  singlePersonRole: boolean;
  singlePersonExposure: boolean;
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

function selectTeams(repo: DemoRepo, teamId?: string | null) {
  return teamId ? repo.teams.filter((team) => team.id === teamId) : repo.teams;
}

function selectRequirements(
  repo: DemoRepo,
  teamId: string,
  roleId?: string | null,
) {
  return repo.coverageRequirements
    .filter((requirement) => requirement.teamId === teamId)
    .filter((requirement) => (roleId ? requirement.roleId === roleId : true))
    .slice()
    .sort((a, b) =>
      a.roleId === b.roleId ? 0 : a.roleId < b.roleId ? -1 : 1,
    );
}

function employeesForRequirement(
  repo: DemoRepo,
  teamId: string,
  roleId: string,
) {
  return repo.employees.filter(
    (employee) => employee.teamId === teamId && employee.roleId === roleId,
  );
}

function employeeMatchesRole(
  employee: DemoEmployee,
  teamId: string,
  roleId: string,
) {
  return employee.teamId === teamId && employee.roleId === roleId;
}

function dateRangeOverlapsDay(day: IsoDate, range: { start: IsoDate; end: IsoDate }) {
  return overlaps({ start: day, end: day }, range);
}

function addExistingAbsencesForDay(
  repo: DemoRepo,
  day: IsoDate,
  teamId: string,
  roleId: string,
  absent: Set<string>,
) {
  for (const absence of repo.existingAbsences) {
    const employee = repo.employees.find((e) => e.id === absence.employeeId);
    if (!employee || !employeeMatchesRole(employee, teamId, roleId)) continue;
    if (dateRangeOverlapsDay(day, { start: absence.startDate, end: absence.endDate })) {
      absent.add(employee.id);
    }
  }
}

function addPtoRequestsForDay(
  repo: DemoRepo,
  day: IsoDate,
  teamId: string,
  roleId: string,
  absent: Set<string>,
) {
  for (const request of repo.ptoRequests) {
    if (request.status === "withdrawn") continue;
    const employee = repo.employees.find((e) => e.id === request.employeeId);
    if (!employee || !employeeMatchesRole(employee, teamId, roleId)) continue;
    if (
      dateRangeOverlapsDay(day, {
        start: request.requestedStartDate,
        end: request.requestedEndDate,
      })
    ) {
      absent.add(employee.id);
    }
  }
}

function absentEmployeesForDay(
  repo: DemoRepo,
  day: IsoDate,
  teamId: string,
  roleId: string,
) {
  const absent = new Set<string>();
  addExistingAbsencesForDay(repo, day, teamId, roleId, absent);
  addPtoRequestsForDay(repo, day, teamId, roleId, absent);
  return absent;
}

function worstComparison(
  current: CoverageComparison,
  next: CoverageComparison,
): CoverageComparison {
  if (next === "below") return "below";
  if (next === "exact" && current === "above") return "exact";
  return current;
}

function measureCoverageAcrossRange(args: {
  repo: DemoRepo;
  requirement: DemoCoverageRequirement;
  employees: DemoEmployee[];
  range: { start: IsoDate; end: IsoDate };
}) {
  const { repo, requirement, employees, range } = args;
  let minAvailable = Number.POSITIVE_INFINITY;
  let worst: CoverageComparison = "above";

  for (const day of eachDayInclusive(range.start, range.end)) {
    const absent = absentEmployeesForDay(
      repo,
      day,
      requirement.teamId,
      requirement.roleId,
    );
    const available = Math.max(0, employees.length - absent.size);
    minAvailable = Math.min(minAvailable, available);
    worst = worstComparison(worst, comparison(requirement.minRequired, available));
  }

  return {
    minAvailable:
      minAvailable === Number.POSITIVE_INFINITY ? employees.length : minAvailable,
    comparison: worst,
  };
}

function buildCoverageRow(args: {
  repo: DemoRepo;
  team: DemoTeam;
  requirement: DemoCoverageRequirement;
  range: { start: IsoDate; end: IsoDate };
}): CoverageMatrixRow {
  const { repo, team, requirement, range } = args;
  const roleName =
    repo.roles.find((role) => role.id === requirement.roleId)?.name ??
    requirement.roleId;
  const employees = employeesForRequirement(repo, team.id, requirement.roleId);
  const measured = measureCoverageAcrossRange({
    repo,
    requirement,
    employees,
    range,
  });
  const singlePersonRole = employees.length === 1;

  return {
    teamId: team.id,
    teamName: team.name,
    roleId: requirement.roleId,
    roleName,
    range,
    required: requirement.minRequired,
    minAvailable: measured.minAvailable,
    comparison: measured.comparison,
    singlePersonRole,
    singlePersonExposure:
      singlePersonRole && measured.minAvailable < requirement.minRequired,
  };
}

export function buildCoverageMatrix(args: {
  repo: DemoRepo;
  range: { start: IsoDate; end: IsoDate };
  teamId?: string | null;
  roleId?: string | null;
}): CoverageMatrixRow[] {
  const { repo, range, teamId, roleId } = args;
  const rows: CoverageMatrixRow[] = [];

  for (const team of selectTeams(repo, teamId)) {
    for (const requirement of selectRequirements(repo, team.id, roleId)) {
      rows.push(buildCoverageRow({ repo, team, requirement, range }));
    }
  }

  return rows;
}
