import { describe, expect, it } from "vitest";

import {
  buildSimulationDraftContext,
  matchesDecisionFilter,
} from "../../../src/domain/simulation";

const baseContext = {
  employeeName: "Avery Park",
  teamName: "Customer Support",
  roleName: "Support Lead",
  requestedStartDate: "2026-06-17",
  requestedEndDate: "2026-06-19",
  band: "risky" as const,
  recommendation: "needs_discussion" as const,
  topReason: "Customer support has two overlapping absences in the same week.",
  conflictCount: 2,
  availableBackupCount: 1,
};

describe("matchesDecisionFilter", () => {
  it("matches all rows when no filter is active", () => {
    expect(matchesDecisionFilter("approve", null)).toBe(true);
    expect(matchesDecisionFilter("none", null)).toBe(true);
  });

  it("matches only the selected simulated decision", () => {
    expect(matchesDecisionFilter("approve", "approve")).toBe(true);
    expect(matchesDecisionFilter("defer", "approve")).toBe(false);
    expect(matchesDecisionFilter("none", "none")).toBe(true);
  });
});

describe("buildSimulationDraftContext", () => {
  it("returns a waiting state before a demo action is chosen", () => {
    const context = buildSimulationDraftContext({
      decision: "none",
      ...baseContext,
    });

    expect(context.title).toBe("Draft context is waiting for a demo action");
    expect(context.summary).toContain(
      "Choose Approve, Defer, or Ask for coverage",
    );
    expect(context.callouts[0]).toContain("Avery Park");
  });

  it("returns action-specific coverage follow-up guidance", () => {
    const context = buildSimulationDraftContext({
      decision: "ask_for_coverage",
      ...baseContext,
    });

    expect(context.title).toBe("Draft context staged for coverage follow-up");
    expect(context.summary).toContain("specific backup coverage confirmation");
    expect(context.callouts.some((item) => item.includes("Support Lead"))).toBe(
      true,
    );
    expect(
      context.callouts.some((item) => item.includes("1 ready backup")),
    ).toBe(true);
  });

  it("returns defer guidance tied to the current blocking signals", () => {
    const context = buildSimulationDraftContext({
      decision: "defer",
      ...baseContext,
    });

    expect(context.title).toBe("Draft context staged for demo defer");
    expect(context.summary).toContain("blocking coverage or timing risk");
    expect(
      context.callouts.some((item) => item.includes("2 current conflict")),
    ).toBe(true);
  });
});
