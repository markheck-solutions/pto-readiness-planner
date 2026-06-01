import type { ClientBase } from "pg";

import { DEMO_SEED_FINGERPRINT, demoSeedDataset } from "../demo/dataset";

export const DEMO_SCHEMA = "pto_demo";
export const DEMO_DATASET_ROW_ID = "demo";

type Queryable = Pick<ClientBase, "query">;

export function getSchemaBootstrapSql(): string[] {
  // Keep this idempotent so seed can safely run against a fresh database.
  return [
    `CREATE SCHEMA IF NOT EXISTS ${DEMO_SCHEMA};`,
    `
    CREATE TABLE IF NOT EXISTS ${DEMO_SCHEMA}.demo_dataset (
      id TEXT PRIMARY KEY,
      dataset_version TEXT NOT NULL,
      seed_fingerprint TEXT NOT NULL,
      seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notice TEXT NOT NULL
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS ${DEMO_SCHEMA}.teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      timezone TEXT NOT NULL,
      description TEXT NOT NULL
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS ${DEMO_SCHEMA}.roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS ${DEMO_SCHEMA}.employees (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      team_id TEXT NOT NULL REFERENCES ${DEMO_SCHEMA}.teams(id),
      role_id TEXT NOT NULL REFERENCES ${DEMO_SCHEMA}.roles(id)
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS ${DEMO_SCHEMA}.coverage_requirements (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES ${DEMO_SCHEMA}.teams(id),
      role_id TEXT NOT NULL REFERENCES ${DEMO_SCHEMA}.roles(id),
      min_required INTEGER NOT NULL,
      notes TEXT NOT NULL
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS ${DEMO_SCHEMA}.critical_windows (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      team_id TEXT NOT NULL REFERENCES ${DEMO_SCHEMA}.teams(id),
      title TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      description TEXT NOT NULL
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS ${DEMO_SCHEMA}.existing_absences (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES ${DEMO_SCHEMA}.employees(id),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      kind TEXT NOT NULL,
      note TEXT NOT NULL
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS ${DEMO_SCHEMA}.pto_requests (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES ${DEMO_SCHEMA}.employees(id),
      requested_start_date DATE NOT NULL,
      requested_end_date DATE NOT NULL,
      request_type TEXT NOT NULL,
      status TEXT NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL,
      employee_note TEXT NOT NULL,
      manager_context TEXT NOT NULL
    );
    `.trim(),
    // Schema upgrades for existing demo databases.
    `ALTER TABLE ${DEMO_SCHEMA}.pto_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';`,
    `
    CREATE TABLE IF NOT EXISTS ${DEMO_SCHEMA}.fairness_history (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL REFERENCES ${DEMO_SCHEMA}.employees(id),
      as_of_date DATE NOT NULL,
      recent_approved_time_off_count INTEGER NOT NULL,
      recent_peak_window_coverage_count INTEGER NOT NULL,
      typical_notice_days INTEGER NOT NULL,
      note TEXT NOT NULL
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS ${DEMO_SCHEMA}.seed_scenarios (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES ${DEMO_SCHEMA}.pto_requests(id),
      title TEXT NOT NULL,
      expected_recommendation TEXT NOT NULL,
      expected_coverage_band TEXT NOT NULL,
      coverage_requirement_comparison TEXT NOT NULL,
      single_person_critical_role_exposure BOOLEAN NOT NULL,
      note TEXT NOT NULL
    );
    `.trim(),
  ];
}

export async function bootstrapDemoSchema(db: Queryable) {
  for (const stmt of getSchemaBootstrapSql()) await db.query(stmt);
}

export type DemoSeedResult = {
  datasetVersion: string;
  seedFingerprint: string;
  counts: Record<string, number>;
};

export async function seedDemoDataset(db: Queryable): Promise<DemoSeedResult> {
  // Delete-first avoids duplicates and keeps re-seeding safe.
  await db.query(`DELETE FROM ${DEMO_SCHEMA}.seed_scenarios;`);
  await db.query(`DELETE FROM ${DEMO_SCHEMA}.pto_requests;`);
  await db.query(`DELETE FROM ${DEMO_SCHEMA}.fairness_history;`);
  await db.query(`DELETE FROM ${DEMO_SCHEMA}.existing_absences;`);
  await db.query(`DELETE FROM ${DEMO_SCHEMA}.critical_windows;`);
  await db.query(`DELETE FROM ${DEMO_SCHEMA}.coverage_requirements;`);
  await db.query(`DELETE FROM ${DEMO_SCHEMA}.employees;`);
  await db.query(`DELETE FROM ${DEMO_SCHEMA}.roles;`);
  await db.query(`DELETE FROM ${DEMO_SCHEMA}.teams;`);

  for (const t of demoSeedDataset.teams) {
    await db.query(
      `INSERT INTO ${DEMO_SCHEMA}.teams (id, name, timezone, description)
       VALUES ($1, $2, $3, $4);`,
      [t.id, t.name, t.timezone, t.description],
    );
  }

  for (const r of demoSeedDataset.roles) {
    await db.query(
      `INSERT INTO ${DEMO_SCHEMA}.roles (id, name, description)
       VALUES ($1, $2, $3);`,
      [r.id, r.name, r.description],
    );
  }

  for (const e of demoSeedDataset.employees) {
    await db.query(
      `INSERT INTO ${DEMO_SCHEMA}.employees (id, display_name, team_id, role_id)
       VALUES ($1, $2, $3, $4);`,
      [e.id, e.displayName, e.teamId, e.roleId],
    );
  }

  for (const c of demoSeedDataset.coverageRequirements) {
    await db.query(
      `INSERT INTO ${DEMO_SCHEMA}.coverage_requirements
         (id, team_id, role_id, min_required, notes)
       VALUES ($1, $2, $3, $4, $5);`,
      [c.id, c.teamId, c.roleId, c.minRequired, c.notes],
    );
  }

  for (const w of demoSeedDataset.criticalWindows) {
    await db.query(
      `INSERT INTO ${DEMO_SCHEMA}.critical_windows
         (id, kind, team_id, title, start_date, end_date, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [w.id, w.kind, w.teamId, w.title, w.startDate, w.endDate, w.description],
    );
  }

  for (const a of demoSeedDataset.existingAbsences) {
    await db.query(
      `INSERT INTO ${DEMO_SCHEMA}.existing_absences
         (id, employee_id, start_date, end_date, kind, note)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [a.id, a.employeeId, a.startDate, a.endDate, a.kind, a.note],
    );
  }

  for (const f of demoSeedDataset.fairnessHistory) {
    await db.query(
      `INSERT INTO ${DEMO_SCHEMA}.fairness_history
         (id, employee_id, as_of_date, recent_approved_time_off_count, recent_peak_window_coverage_count, typical_notice_days, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [
        f.id,
        f.employeeId,
        f.asOfDate,
        f.recentApprovedTimeOffCount,
        f.recentPeakWindowCoverageCount,
        f.typicalNoticeDays,
        f.note,
      ],
    );
  }

  for (const r of demoSeedDataset.ptoRequests) {
    await db.query(
      `INSERT INTO ${DEMO_SCHEMA}.pto_requests
         (id, employee_id, requested_start_date, requested_end_date, request_type, status, submitted_at, employee_note, manager_context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
      [
        r.id,
        r.employeeId,
        r.requestedStartDate,
        r.requestedEndDate,
        r.requestType,
        r.status,
        r.submittedAt,
        r.employeeNote,
        r.managerContext,
      ],
    );
  }

  for (const s of demoSeedDataset.scenarios) {
    await db.query(
      `INSERT INTO ${DEMO_SCHEMA}.seed_scenarios
         (id, request_id, title, expected_recommendation, expected_coverage_band, coverage_requirement_comparison, single_person_critical_role_exposure, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [
        s.id,
        s.requestId,
        s.title,
        s.expectedRecommendation,
        s.expectedCoverageBand,
        s.coverageRequirementComparison,
        s.singlePersonCriticalRoleExposure,
        s.note,
      ],
    );
  }

  await db.query(
    `INSERT INTO ${DEMO_SCHEMA}.demo_dataset
       (id, dataset_version, seed_fingerprint, seeded_at, notice)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (id)
     DO UPDATE SET
       dataset_version = EXCLUDED.dataset_version,
       seed_fingerprint = EXCLUDED.seed_fingerprint,
       seeded_at = EXCLUDED.seeded_at,
       notice = EXCLUDED.notice;`,
    [
      DEMO_DATASET_ROW_ID,
      demoSeedDataset.version,
      DEMO_SEED_FINGERPRINT,
      demoSeedDataset.notice,
    ],
  );

  return {
    datasetVersion: demoSeedDataset.version,
    seedFingerprint: DEMO_SEED_FINGERPRINT,
    counts: {
      teams: demoSeedDataset.teams.length,
      roles: demoSeedDataset.roles.length,
      employees: demoSeedDataset.employees.length,
      coverageRequirements: demoSeedDataset.coverageRequirements.length,
      criticalWindows: demoSeedDataset.criticalWindows.length,
      existingAbsences: demoSeedDataset.existingAbsences.length,
      fairnessHistory: demoSeedDataset.fairnessHistory.length,
      ptoRequests: demoSeedDataset.ptoRequests.length,
      scenarios: demoSeedDataset.scenarios.length,
    },
  };
}
