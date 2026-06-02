import type { DemoCoverageBand } from "../../demo/dataset";
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

export function buildCalendarHeatmap(args: {
  repo: DemoRepo;
  preset: "next-8-weeks" | "next-12-weeks";
  teamId?: string | null;
}): HeatmapResult {
  const { repo, preset, teamId } = args;

  const startDate = repo.meta.dateBounds.startDate;
  const spanDays = preset === "next-12-weeks" ? 83 : 55;
  const endDate = addDaysIsoDate(startDate, spanDays);
  const boundedEnd =
    endDate > repo.meta.dateBounds.endDate
      ? repo.meta.dateBounds.endDate
      : endDate;

  const cells: HeatmapCell[] = [];

  const teams = teamId ? repo.teams.filter((t) => t.id === teamId) : repo.teams;

  for (const day of eachDayInclusive(startDate, boundedEnd)) {
    let dayBand: DemoCoverageBand = "healthy";
    const reasons: string[] = [];

    for (const team of teams) {
      const windows = repo.criticalWindows.filter((w) => w.teamId === team.id);
      for (const w of windows) {
        if (
          overlaps(
            { start: day, end: day },
            { start: w.startDate, end: w.endDate },
          )
        ) {
          reasons.push(`${team.name}: critical window "${w.title}"`);
          dayBand = worstBand(
            dayBand,
            w.kind === "blackout" ? "critical" : "thin",
          );
        }
      }

      for (const req of repo.coverageRequirements.filter(
        (c) => c.teamId === team.id,
      )) {
        const role = repo.roles.find((r) => r.id === req.roleId);
        const roleName = role?.name ?? req.roleId;
        const employees = repo.employees.filter(
          (e) => e.teamId === team.id && e.roleId === req.roleId,
        );

        const absent = new Set<string>();
        for (const a of repo.existingAbsences) {
          const emp = repo.employees.find((e) => e.id === a.employeeId);
          if (!emp) continue;
          if (emp.teamId !== team.id || emp.roleId !== req.roleId) continue;
          if (
            overlaps(
              { start: day, end: day },
              { start: a.startDate, end: a.endDate },
            )
          )
            absent.add(emp.id);
        }
        // For heatmap pressure, treat all non-withdrawn requests as potential absences.
        for (const r of repo.ptoRequests) {
          if (r.status === "withdrawn") continue;
          const emp = repo.employees.find((e) => e.id === r.employeeId);
          if (!emp) continue;
          if (emp.teamId !== team.id || emp.roleId !== req.roleId) continue;
          if (
            overlaps(
              { start: day, end: day },
              { start: r.requestedStartDate, end: r.requestedEndDate },
            )
          )
            absent.add(emp.id);
        }

        const available = Math.max(0, employees.length - absent.size);
        const roleBand = bandFromCoverage(req.minRequired, available);
        dayBand = worstBand(dayBand, roleBand);

        if (roleBand !== "healthy") {
          reasons.push(
            `${team.name}: ${roleName} coverage ${available}/${req.minRequired}`,
          );
        }

        if (employees.length === 1 && available < req.minRequired) {
          dayBand = worstBand(dayBand, "critical");
          reasons.push(`${team.name}: ${roleName} is single-person coverage`);
        }
      }
    }

    cells.push({
      date: day,
      band: dayBand,
      topPressureReasons: reasons.slice(0, 3),
    });
  }

  return {
    range: { preset, startDate, endDate: boundedEnd },
    cells,
  };
}
