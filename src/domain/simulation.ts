export type DemoDecision = "none" | "approve" | "defer" | "ask_for_coverage";

export function decisionLabel(decision: DemoDecision): string {
  if (decision === "approve") return "Approved in demo";
  if (decision === "defer") return "Deferred in demo";
  if (decision === "ask_for_coverage") return "Ask for coverage in demo";
  return "No simulated decision";
}

export function decisionActionLabel(decision: DemoDecision): string | null {
  if (decision === "approve") return "Approve";
  if (decision === "defer") return "Defer";
  if (decision === "ask_for_coverage") return "Ask for coverage";
  return null;
}
