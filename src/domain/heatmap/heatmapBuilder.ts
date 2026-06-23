import type {
  DemoCoverageBand,
  DemoCoverageRequirement,
  DemoEmployee,
  DemoTeam,
} from "../../demo/dataset";
import type { DemoRepo } from "../../repos/demoRepo";
import type { IsoDate } from "../dates";
import { addDaysIsoDate, eachDayInclusive } from "../dates";

export type HeatmapCell = {
  date: IsoDate;
  band: DemoCoverageBand;
  topPressureReasons: string[];
};

export type HeatmapResult = {
  range: { preset: string; startDate: IsoDate; endDate: IsoDate };
  cells: HeatmapCell[];
};

function worstBand(a: DemoCoverageBand, b: DemoCoverageBand): DemoCoverageBand {
  const order: Record<DemoCoverageBand, number> = {
    healthy: 0,
    thin: 1,
    risky: 2,
    critical: 3,
  };
  return order[b] > order[a] ? b : a;
}

function bandFromCoverage(
  required: number,
  available: number,
): DemoCoverageBand {
  if (required <= 0) return "healthy";
  if (available < required) return "risky";
  if (available === required) return "thin";
  return "healthy";
}

function overlaps(
  a: { start: IsoDate; end: IsoDate },
  b: { start: IsoDate; end: IsoDate },
): boolean {
  return !(a.end < b.start || b.end < a.start);
}

type HeatmapPressure = {
  band: DemoCoverageBand;
  reasons: string[];
};

function heatmapRange(
  repo: DemoRepo,
  preset: "next-8-weeks" | "next-12-weeks",
) {
  const startDate = repo.meta.dateBounds.startDate;
  const spanDays = preset === "next-12-weeks" ? 83 : 55;
  const endDate = addDaysIsoDate(startDate, spanDays);
  const boundedEnd =
    endDate > repo.meta.dateBounds.endDate
      ? repo.meta.dateBounds.endDate
      : endDate;

  return { startDate, endDate: boundedEnd };
}

function selectTeams(repo: DemoRepo, teamId?: string | null) {
  return teamId ? repo.teams.filter((team) => team.id === teamId) : repo.teams;
}

function selectCoverageRequirements(
  repo: DemoRepo,
  teamId: string,
  roleId?: string | null,
) {
  return repo.coverageRequirements.filter(
    (requirement) =>
      requirement.teamId === teamId &&
      (roleId ? requirement.roleId === roleId : true),
  );
}

function mergePressure(
  current: HeatmapPressure,
  next: HeatmapPressure,
): HeatmapPressure {
  return {
    band: worstBand(current.band, next.band),
    reasons: [...current.reasons, ...next.reasons],
  };
}

function criticalWindowPressure(
  repo: DemoRepo,
  team: DemoTeam,
  day: IsoDate,
): HeatmapPressure {
  let band: DemoCoverageBand = "healthy";
  const reasons: string[] = [];

  for (const window of repo.criticalWindows.filter(
    (w) => w.teamId === team.id,
  )) {
    if (
      !overlaps(
        { start: day, end: day },
        { start: window.startDate, end: window.endDate },
      )
    ) {
      continue;
    }
    reasons.push(`${team.name}: critical window "${window.title}"`);
    band = worstBand(band, window.kind === "blackout" ? "critical" : "thin");
  }

  return { band, reasons };
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

function employeeMatchesRequirement(
  employee: DemoEmployee,
  teamId: string,
  roleId: string,
) {
  return employee.teamId === teamId && employee.roleId === roleId;
}

function addExistingAbsences(
  repo: DemoRepo,
  day: IsoDate,
  requirement: DemoCoverageRequirement,
  absent: Set<string>,
) {
  for (const absence of repo.existingAbsences) {
    const employee = repo.employees.find((e) => e.id === absence.employeeId);
    if (
      !employee ||
      !employeeMatchesRequirement(
        employee,
        requirement.teamId,
        requirement.roleId,
      )
    ) {
      continue;
    }
    if (
      overlaps(
        { start: day, end: day },
        { start: absence.startDate, end: absence.endDate },
      )
    ) {
      absent.add(employee.id);
    }
  }
}

function addPendingRequestAbsences(
  repo: DemoRepo,
  day: IsoDate,
  requirement: DemoCoverageRequirement,
  absent: Set<string>,
) {
  for (const request of repo.ptoRequests) {
    if (request.status === "withdrawn") continue;
    const employee = repo.employees.find((e) => e.id === request.employeeId);
    if (
      !employee ||
      !employeeMatchesRequirement(
        employee,
        requirement.teamId,
        requirement.roleId,
      )
    ) {
      continue;
    }
    if (
      overlaps(
        { start: day, end: day },
        { start: request.requestedStartDate, end: request.requestedEndDate },
      )
    ) {
      absent.add(employee.id);
    }
  }
}

function absentEmployeesForRequirement(
  repo: DemoRepo,
  day: IsoDate,
  requirement: DemoCoverageRequirement,
) {
  const absent = new Set<string>();
  addExistingAbsences(repo, day, requirement, absent);
  addPendingRequestAbsences(repo, day, requirement, absent);
  return absent;
}

function roleCoveragePressure(args: {
  repo: DemoRepo;
  team: DemoTeam;
  requirement: DemoCoverageRequirement;
  day: IsoDate;
}): HeatmapPressure {
  const { repo, team, requirement, day } = args;
  const role = repo.roles.find((r) => r.id === requirement.roleId);
  const roleName = role?.name ?? requirement.roleId;
  const employees = employeesForRequirement(repo, team.id, requirement.roleId);
  const absent = absentEmployeesForRequirement(repo, day, requirement);
  const available = Math.max(0, employees.length - absent.size);
  const roleBand = bandFromCoverage(requirement.minRequired, available);
  const reasons: string[] = [];
  let band = roleBand;

  if (roleBand !== "healthy") {
    reasons.push(
      `${team.name}: ${roleName} coverage ${available}/${requirement.minRequired}`,
    );
  }

  if (employees.length === 1 && available < requirement.minRequired) {
    band = worstBand(band, "critical");
    reasons.push(`${team.name}: ${roleName} is single-person coverage`);
  }

  return { band, reasons };
}

function teamPressureForDay(
  repo: DemoRepo,
  team: DemoTeam,
  day: IsoDate,
  roleId?: string | null,
): HeatmapPressure {
  let pressure = criticalWindowPressure(repo, team, day);

  for (const requirement of selectCoverageRequirements(repo, team.id, roleId)) {
    pressure = mergePressure(
      pressure,
      roleCoveragePressure({ repo, team, requirement, day }),
    );
  }

  return pressure;
}

function buildHeatmapCell(args: {
  repo: DemoRepo;
  teams: DemoTeam[];
  day: IsoDate;
  roleId?: string | null;
}): HeatmapCell {
  const { repo, teams, day, roleId } = args;
  let pressure: HeatmapPressure = { band: "healthy", reasons: [] };

  for (const team of teams) {
    pressure = mergePressure(
      pressure,
      teamPressureForDay(repo, team, day, roleId),
    );
  }

  return {
    date: day,
    band: pressure.band,
    topPressureReasons: pressure.reasons.slice(0, 3),
  };
}

export function buildCalendarHeatmap(args: {
  repo: DemoRepo;
  preset: "next-8-weeks" | "next-12-weeks";
  teamId?: string | null;
  roleId?: string | null;
}): HeatmapResult {
  const { repo, preset, teamId, roleId } = args;
  const range = heatmapRange(repo, preset);
  const teams = selectTeams(repo, teamId);

  const cells = eachDayInclusive(range.startDate, range.endDate).map((day) =>
    buildHeatmapCell({ repo, teams, day, roleId }),
  );

  return {
    range: { preset, startDate: range.startDate, endDate: range.endDate },
    cells,
  };
}
