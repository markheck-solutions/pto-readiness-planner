import {
  DEMO_DATE_BOUNDS,
  DEMO_DATASET_VERSION,
  DEMO_FICTIONAL_NOTICE,
  DEMO_SEED_FINGERPRINT,
  demoSeedDataset,
  type DemoCoverageRequirement,
  type DemoCriticalWindow,
  type DemoEmployee,
  type DemoExistingAbsence,
  type DemoFairnessHistory,
  type DemoPtoRequest,
  type DemoRole,
  type DemoSeedDataset,
  type DemoSeedScenario,
  type DemoTeam,
} from "../demo/dataset";

export type DemoRepo = {
  meta: {
    datasetVersion: string;
    seedFingerprint: string;
    notice: string;
    dateBounds: typeof DEMO_DATE_BOUNDS;
  };
  teams: DemoTeam[];
  roles: DemoRole[];
  employees: DemoEmployee[];
  coverageRequirements: DemoCoverageRequirement[];
  criticalWindows: DemoCriticalWindow[];
  existingAbsences: DemoExistingAbsence[];
  fairnessHistory: DemoFairnessHistory[];
  ptoRequests: DemoPtoRequest[];
  seedScenarios: DemoSeedScenario[];
};

export function getDemoRepo(
  dataset: DemoSeedDataset = demoSeedDataset,
): DemoRepo {
  return {
    meta: {
      datasetVersion: DEMO_DATASET_VERSION,
      seedFingerprint: DEMO_SEED_FINGERPRINT,
      notice: DEMO_FICTIONAL_NOTICE,
      dateBounds: dataset.dateBounds,
    },
    teams: dataset.teams,
    roles: dataset.roles,
    employees: dataset.employees,
    coverageRequirements: dataset.coverageRequirements,
    criticalWindows: dataset.criticalWindows,
    existingAbsences: dataset.existingAbsences,
    fairnessHistory: dataset.fairnessHistory,
    ptoRequests: dataset.ptoRequests,
    seedScenarios: dataset.scenarios,
  };
}

export function findTeamById(repo: DemoRepo, teamId: string): DemoTeam | null {
  return repo.teams.find((t) => t.id === teamId) ?? null;
}

export function findRoleById(repo: DemoRepo, roleId: string): DemoRole | null {
  return repo.roles.find((r) => r.id === roleId) ?? null;
}

export function findEmployeeById(
  repo: DemoRepo,
  employeeId: string,
): DemoEmployee | null {
  return repo.employees.find((e) => e.id === employeeId) ?? null;
}

export function findPtoRequestById(
  repo: DemoRepo,
  requestId: string,
): DemoPtoRequest | null {
  return repo.ptoRequests.find((r) => r.id === requestId) ?? null;
}

export function findFairnessByEmployeeId(
  repo: DemoRepo,
  employeeId: string,
): DemoFairnessHistory | null {
  return repo.fairnessHistory.find((f) => f.employeeId === employeeId) ?? null;
}
