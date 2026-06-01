import fs from "node:fs";

import { describe, it, expect } from "vitest";

function readText(p: string) {
  return fs.readFileSync(p, "utf8");
}

describe("repo maturity scaffold", () => {
  it("includes operator-facing docs and templates", () => {
    const required = [
      "README.md",
      "docs/runbooks/operations.md",
      "docs/validation/INDEX.md",
      ".github/workflows/ci.yml",
      ".github/CODEOWNERS",
      ".github/pull_request_template.md",
      ".github/ISSUE_TEMPLATE/bug_report.yml",
      ".github/ISSUE_TEMPLATE/readiness_task.yml",
    ];

    for (const p of required) {
      expect(fs.existsSync(p), `missing: ${p}`).toBe(true);
    }
  });

  it("does not include Next.js template leftovers in README", () => {
    const readme = readText("README.md");
    expect(readme).not.toMatch(/localhost:3000/i);
    expect(readme).not.toMatch(/\byarn\b/i);
    expect(readme).not.toMatch(/\bpnpm\b/i);
    expect(readme).not.toMatch(/\bbun\b/i);
    expect(readme).toMatch(/127\.0\.0\.1:3102/i);
  });
});
