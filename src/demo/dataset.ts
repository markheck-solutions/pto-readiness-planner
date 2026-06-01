import crypto from "node:crypto";

export type DemoTeam = {
  id: string;
  name: string;
  timezone: string;
  description: string;
};

export type DemoRole = {
  id: string;
  name: string;
  description: string;
};

export type DemoEmployee = {
  id: string;
  displayName: string;
  teamId: string;
  roleId: string;
};

export type DemoCoverageRequirement = {
  id: string;
  teamId: string;
  roleId: string;
  minRequired: number;
  notes: string;
};

export type DemoCriticalWindow = {
  id: string;
  kind: "delivery_window" | "blackout" | "change_freeze";
  teamId: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  description: string;
};

export type DemoExistingAbsence = {
  id: string;
  employeeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  kind: "pto" | "sick" | "training";
  note: string;
};

export type DemoPtoRequest = {
  id: string;
  employeeId: string;
  requestedStartDate: string; // YYYY-MM-DD
  requestedEndDate: string; // YYYY-MM-DD
  requestType: "pto";
  submittedAt: string; // ISO
  employeeNote: string;
  managerContext: string;
};

export type DemoCoverageBand = "healthy" | "thin" | "risky" | "critical";

export type DemoRecommendation =
  | "approve"
  | "approve_with_coverage_actions"
  | "needs_discussion"
  | "defer";

export type DemoSeedScenario = {
  id: string;
  requestId: string;
  title: string;
  expectedRecommendation: DemoRecommendation;
  expectedCoverageBand: DemoCoverageBand;
  coverageRequirementComparison: "above" | "exact" | "below";
  singlePersonCriticalRoleExposure: boolean;
  note: string;
};

export const DEMO_DATASET_VERSION = "2026-06-01-demo-v1";

export const DEMO_FICTIONAL_NOTICE =
  "Fictional demo data only. No login. No HR system connection.";

export const DEMO_DATE_BOUNDS = {
  startDate: "2026-06-17",
  endDate: "2026-08-16",
} as const;

export const demoTeams: DemoTeam[] = [
  {
    id: "team_release_ops",
    name: "Release Operations",
    timezone: "America/Los_Angeles",
    description: "Release coordination, change readiness, and cut-week support.",
  },
  {
    id: "team_customer_support",
    name: "Customer Support",
    timezone: "America/New_York",
    description:
      "Escalations, incident coordination, and customer-impact triage coverage.",
  },
  {
    id: "team_delivery",
    name: "Delivery",
    timezone: "America/Chicago",
    description: "Delivery planning, tracking, and cross-team dependency follow-up.",
  },
];

export const demoRoles: DemoRole[] = [
  {
    id: "role_release_coordinator",
    name: "Release Coordinator",
    description: "Owns cut-week coordination and release comms.",
  },
  {
    id: "role_escalation_owner",
    name: "Escalation Owner",
    description: "Primary decision-maker for active escalations and customer triage.",
  },
  {
    id: "role_support_lead",
    name: "Support Lead",
    description: "Run the shift lead rotation and keep service continuity stable.",
  },
  {
    id: "role_delivery_analyst",
    name: "Delivery Analyst",
    description: "Tracks delivery risk, blockers, and change readiness signals.",
  },
];

export const demoEmployees: DemoEmployee[] = [
  {
    id: "emp_avery_park",
    displayName: "Avery Park",
    teamId: "team_release_ops",
    roleId: "role_release_coordinator",
  },
  {
    id: "emp_morgan_lee",
    displayName: "Morgan Lee",
    teamId: "team_release_ops",
    roleId: "role_release_coordinator",
  },
  {
    id: "emp_jordan_kim",
    displayName: "Jordan Kim",
    teamId: "team_customer_support",
    roleId: "role_escalation_owner",
  },
  {
    id: "emp_casey_patel",
    displayName: "Casey Patel",
    teamId: "team_customer_support",
    roleId: "role_support_lead",
  },
  {
    id: "emp_taylor_nguyen",
    displayName: "Taylor Nguyen",
    teamId: "team_customer_support",
    roleId: "role_support_lead",
  },
  {
    id: "emp_sam_rivera",
    displayName: "Sam Rivera",
    teamId: "team_delivery",
    roleId: "role_delivery_analyst",
  },
  {
    id: "emp_riley_chen",
    displayName: "Riley Chen",
    teamId: "team_delivery",
    roleId: "role_delivery_analyst",
  },
  {
    id: "emp_alex_diaz",
    displayName: "Alex Diaz",
    teamId: "team_delivery",
    roleId: "role_delivery_analyst",
  },
];

export const demoCoverageRequirements: DemoCoverageRequirement[] = [
  {
    id: "covreq_release_ops_release_coordinator",
    teamId: "team_release_ops",
    roleId: "role_release_coordinator",
    minRequired: 1,
    notes: "Cut week requires at least one coordinator available.",
  },
  {
    id: "covreq_support_escalation_owner",
    teamId: "team_customer_support",
    roleId: "role_escalation_owner",
    minRequired: 1,
    notes: "Escalations require a named primary owner each day.",
  },
  {
    id: "covreq_support_support_lead",
    teamId: "team_customer_support",
    roleId: "role_support_lead",
    minRequired: 2,
    notes: "Two leads provide shift overlap and incident handoff safety.",
  },
  {
    id: "covreq_delivery_delivery_analyst",
    teamId: "team_delivery",
    roleId: "role_delivery_analyst",
    minRequired: 1,
    notes: "At least one analyst must be available for cross-team follow-up.",
  },
];

export const demoCriticalWindows: DemoCriticalWindow[] = [
  {
    id: "cw_release_cut_week",
    kind: "delivery_window",
    teamId: "team_release_ops",
    title: "Release cut week",
    startDate: "2026-06-23",
    endDate: "2026-06-28",
    description:
      "Higher change volume and coordination load. Coverage gaps have outsized impact.",
  },
  {
    id: "cw_support_freeze",
    kind: "change_freeze",
    teamId: "team_customer_support",
    title: "Support tooling freeze",
    startDate: "2026-07-01",
    endDate: "2026-07-03",
    description:
      "Limited ability to change workflows. Escalations need stable owner coverage.",
  },
  {
    id: "cw_delivery_blackout",
    kind: "blackout",
    teamId: "team_delivery",
    title: "Quarter close reporting blackout",
    startDate: "2026-08-10",
    endDate: "2026-08-14",
    description:
      "Reporting deadlines. Avoid coverage dips that create delivery blind spots.",
  },
];

export const demoExistingAbsences: DemoExistingAbsence[] = [
  {
    id: "abs_taylor_pto_jul1",
    employeeId: "emp_taylor_nguyen",
    startDate: "2026-07-01",
    endDate: "2026-07-02",
    kind: "pto",
    note: "Already-approved PTO from earlier planning.",
  },
];

export const demoPtoRequests: DemoPtoRequest[] = [
  {
    id: "REQ-1001",
    employeeId: "emp_avery_park",
    requestedStartDate: "2026-06-24",
    requestedEndDate: "2026-06-28",
    requestType: "pto",
    submittedAt: "2026-06-10T15:20:00.000Z",
    employeeNote: "Planned PTO with advance notice.",
    managerContext: "Overlaps release cut week; confirm backup coverage and handoffs.",
  },
  {
    id: "REQ-1002",
    employeeId: "emp_jordan_kim",
    requestedStartDate: "2026-07-01",
    requestedEndDate: "2026-07-03",
    requestType: "pto",
    submittedAt: "2026-06-28T10:05:00.000Z",
    employeeNote: "Short absence request.",
    managerContext:
      "Single-person escalation role during a freeze window. Needs reschedule or coverage plan.",
  },
  {
    id: "REQ-1003",
    employeeId: "emp_sam_rivera",
    requestedStartDate: "2026-07-15",
    requestedEndDate: "2026-07-19",
    requestType: "pto",
    submittedAt: "2026-06-29T19:40:00.000Z",
    employeeNote: "Planned PTO outside critical windows.",
    managerContext: "No overlaps. Coverage stays above minimum for delivery analyst role.",
  },
  {
    id: "REQ-1004",
    employeeId: "emp_casey_patel",
    requestedStartDate: "2026-07-01",
    requestedEndDate: "2026-07-03",
    requestType: "pto",
    submittedAt: "2026-06-25T13:00:00.000Z",
    employeeNote: "PTO request during a busy week.",
    managerContext:
      "Overlaps an existing support lead absence. Coverage drops below requirement; discuss alternatives.",
  },
];

export const demoSeedScenarios: DemoSeedScenario[] = [
  {
    id: "scenario_approve_healthy",
    requestId: "REQ-1003",
    title: "Approve: healthy coverage with no critical overlaps",
    expectedRecommendation: "approve",
    expectedCoverageBand: "healthy",
    coverageRequirementComparison: "above",
    singlePersonCriticalRoleExposure: false,
    note: "Delivery analyst role stays above minimum and avoids blackout windows.",
  },
  {
    id: "scenario_approve_with_actions_thin",
    requestId: "REQ-1001",
    title: "Approve with coverage actions: thin coverage during cut week",
    expectedRecommendation: "approve_with_coverage_actions",
    expectedCoverageBand: "thin",
    coverageRequirementComparison: "exact",
    singlePersonCriticalRoleExposure: false,
    note: "Coverage is exactly at minimum. Require handoffs and a named backup.",
  },
  {
    id: "scenario_discuss_risky",
    requestId: "REQ-1004",
    title: "Needs discussion: risky coverage below requirement with overlap",
    expectedRecommendation: "needs_discussion",
    expectedCoverageBand: "risky",
    coverageRequirementComparison: "below",
    singlePersonCriticalRoleExposure: false,
    note: "Support lead coverage falls below requirement due to overlap.",
  },
  {
    id: "scenario_defer_critical",
    requestId: "REQ-1002",
    title: "Defer: critical single-person role exposure during freeze",
    expectedRecommendation: "defer",
    expectedCoverageBand: "critical",
    coverageRequirementComparison: "below",
    singlePersonCriticalRoleExposure: true,
    note: "Escalation owner role is single-person coverage during a freeze window.",
  },
];

export type DemoSeedDataset = {
  version: string;
  notice: string;
  dateBounds: typeof DEMO_DATE_BOUNDS;
  teams: DemoTeam[];
  roles: DemoRole[];
  employees: DemoEmployee[];
  coverageRequirements: DemoCoverageRequirement[];
  criticalWindows: DemoCriticalWindow[];
  existingAbsences: DemoExistingAbsence[];
  ptoRequests: DemoPtoRequest[];
  scenarios: DemoSeedScenario[];
};

export const demoSeedDataset: DemoSeedDataset = {
  version: DEMO_DATASET_VERSION,
  notice: DEMO_FICTIONAL_NOTICE,
  dateBounds: DEMO_DATE_BOUNDS,
  teams: demoTeams,
  roles: demoRoles,
  employees: demoEmployees,
  coverageRequirements: demoCoverageRequirements,
  criticalWindows: demoCriticalWindows,
  existingAbsences: demoExistingAbsences,
  ptoRequests: demoPtoRequests,
  scenarios: demoSeedScenarios,
};

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => {
      if (a === b) return 0;
      return a < b ? -1 : 1;
    });
    const pairs = keys.map(
      (k) => `${JSON.stringify(k)}:${stableSerialize(record[k])}`,
    );
    return `{${pairs.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeSeedFingerprint(dataset: DemoSeedDataset): string {
  const stable = stableSerialize(dataset);
  return crypto.createHash("sha256").update(stable).digest("hex");
}

export const DEMO_SEED_FINGERPRINT = computeSeedFingerprint(demoSeedDataset);
