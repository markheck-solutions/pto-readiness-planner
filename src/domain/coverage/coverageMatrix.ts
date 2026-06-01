import type { DemoRepo } from "../../repos/demoRepo";
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

export function buildCoverageMatrix(args: {
  repo: DemoRepo;
  range: { start: IsoDate; end: IsoDate };
  teamId?: string | null;
  roleId?: string | null;
}): CoverageMatrixRow[] {
  const { repo, range, teamId, roleId } = args;

  const teams = teamId ? repo.teams.filter((t) => t.id === teamId) : repo.teams;

  const rows: CoverageMatrixRow[] = [];

  for (const team of teams) {
    const requirements = repo.coverageRequirements
      .filter((r) => r.teamId === team.id)
      .filter((r) => (roleId ? r.roleId === roleId : true))
      .slice()
      .sort((a, b) => (a.roleId === b.roleId ? 0 : a.roleId < b.roleId ? -1 : 1));

    for (const req of requirements) {
      const roleName = repo.roles.find((r) => r.id === req.roleId)?.name ?? req.roleId;
      const employees = repo.employees.filter((e) => e.teamId === team.id && e.roleId === req.roleId);

      let minAvailable = Number.POSITIVE_INFINITY;
      let worst: CoverageComparison = "above";

      for (const day of eachDayInclusive(range.start, range.end)) {
        const absent = new Set<string>();
        for (const a of repo.existingAbsences) {
          const emp = repo.employees.find((e) => e.id === a.employeeId);
          if (!emp) continue;
          if (emp.teamId !== team.id || emp.roleId !== req.roleId) continue;
          if (overlaps({ start: day, end: day }, { start: a.startDate, end: a.endDate })) absent.add(emp.id);
        }

        // Treat non-withdrawn requests as potential absences for planning.
        for (const r of repo.ptoRequests) {
          if (r.status === "withdrawn") continue;
          const emp = repo.employees.find((e) => e.id === r.employeeId);
          if (!emp) continue;
          if (emp.teamId !== team.id || emp.roleId !== req.roleId) continue;
          if (overlaps({ start: day, end: day }, { start: r.requestedStartDate, end: r.requestedEndDate })) absent.add(emp.id);
        }

        const available = Math.max(0, employees.length - absent.size);
        minAvailable = Math.min(minAvailable, available);

        const c = comparison(req.minRequired, available);
        if (c === "below") worst = "below";
        else if (c === "exact" && worst === "above") worst = "exact";
      }

      if (minAvailable === Number.POSITIVE_INFINITY) minAvailable = employees.length;
      const singlePersonRole = employees.length === 1;
      const singlePersonExposure = singlePersonRole && minAvailable < req.minRequired;

      rows.push({
        teamId: team.id,
        teamName: team.name,
        roleId: req.roleId,
        roleName,
        range,
        required: req.minRequired,
        minAvailable,
        comparison: worst,
        singlePersonRole,
        singlePersonExposure,
      });
    }
  }

  return rows;
}
