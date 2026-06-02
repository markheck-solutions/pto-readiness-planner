import { describe, expect, it } from "vitest";

import {
  buildAuditSection,
  type SafeRunResult,
} from "../../scripts/readiness-report-lib";

function buildAuditResult(overrides: Partial<SafeRunResult>): SafeRunResult {
  return {
    ok: true,
    stdout: "",
    stderr: "",
    ...overrides,
  };
}

describe("readiness report npm audit gate", () => {
  it("fails when high or critical findings arrive through a non-zero audit exit", () => {
    const audit = buildAuditSection(
      buildAuditResult({
        ok: false,
        exitCode: 1,
        error: "exit code 1: npm audit reported vulnerabilities",
        stdout: JSON.stringify({
          metadata: {
            vulnerabilities: {
              total: 2,
              critical: 1,
              high: 1,
              moderate: 0,
              low: 0,
            },
          },
        }),
      }),
    );

    expect(audit.status).toBe("FAIL");
    expect(audit.lines.join("\n")).toContain(
      "npm audit exited non-zero but produced JSON output",
    );
    expect(audit.lines).toContain("  - critical: 1");
    expect(audit.lines).toContain("  - high: 1");
  });

  it("warns when only moderate or low findings are present", () => {
    const audit = buildAuditSection(
      buildAuditResult({
        ok: false,
        exitCode: 1,
        error: "exit code 1: npm audit reported vulnerabilities",
        stdout: JSON.stringify({
          metadata: {
            vulnerabilities: {
              total: 3,
              critical: 0,
              high: 0,
              moderate: 2,
              low: 1,
            },
          },
        }),
      }),
    );

    expect(audit.status).toBe("WARN");
    expect(audit.lines).toContain("  - moderate: 2");
    expect(audit.lines).toContain("  - low: 1");
    expect(audit.lines.join("\n")).toContain(
      "Review moderate or low findings and plan upgrades where feasible.",
    );
  });

  it("warns when npm audit fails without parseable JSON output", () => {
    const audit = buildAuditSection(
      buildAuditResult({
        ok: false,
        exitCode: 1,
        error: "exit code 1: command failed",
        stderr: "npm ERR! audit endpoint returned HTML",
        stdout: "<html>not-json</html>",
      }),
    );

    expect(audit.status).toBe("WARN");
    expect(audit.lines[0]).toBe(
      "- npm audit produced non-parseable JSON output.",
    );
    expect(audit.lines.join("\n")).toContain("Parse error:");
  });
});
