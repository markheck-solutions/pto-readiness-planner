export type DemoPtoRequest = {
  id: string;
  employeeName: string;
  team: string;
  role: string;
  dateRange: string;
  summary: string;
  riskBand: "Low" | "Medium" | "High";
  recommendation:
    | "Approve"
    | "Approve with coverage actions"
    | "Discuss"
    | "Defer";
  topReason: string;
};

export const demoPtoRequests: DemoPtoRequest[] = [
  {
    id: "REQ-1001",
    employeeName: "Avery Park",
    team: "Release Operations",
    role: "Release Coordinator",
    dateRange: "Jun 24 to Jun 28",
    summary: "Planned PTO with two weeks notice.",
    riskBand: "Medium",
    recommendation: "Approve with coverage actions",
    topReason: "Single backup for release cut week.",
  },
  {
    id: "REQ-1002",
    employeeName: "Jordan Kim",
    team: "Customer Support",
    role: "Escalation Owner",
    dateRange: "Jul 1 to Jul 3",
    summary: "Short absence overlapping an on-call rotation.",
    riskBand: "High",
    recommendation: "Discuss",
    topReason: "Coverage below requirement for escalation role.",
  },
  {
    id: "REQ-1003",
    employeeName: "Sam Rivera",
    team: "Delivery",
    role: "Delivery Analyst",
    dateRange: "Jul 15 to Jul 19",
    summary: "Planned PTO outside critical windows.",
    riskBand: "Low",
    recommendation: "Approve",
    topReason: "No overlaps and coverage above requirement.",
  },
];

export function findDemoPtoRequestById(requestId: string) {
  return demoPtoRequests.find((r) => r.id === requestId) ?? null;
}
