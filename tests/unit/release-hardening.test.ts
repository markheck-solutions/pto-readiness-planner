import fs from "node:fs";

import { describe, expect, it } from "vitest";

function readText(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

describe("release hardening scaffold", () => {
  it("includes QA, wiki, and security automation files", () => {
    const required = [
      ".factory/skills/qa/SKILL.md",
      ".factory/skills/qa/config.yaml",
      ".factory/skills/qa/REPORT-TEMPLATE.md",
      ".factory/skills/qa-web/SKILL.md",
      ".factory/skills/qa-api/SKILL.md",
      ".factory/droids/worker.md",
      ".github/workflows/qa.yml",
      ".github/workflows/codeql.yml",
      ".github/workflows/droid-wiki-refresh.yml",
      ".github/dependabot.yml",
    ];

    for (const filePath of required) {
      expect(fs.existsSync(filePath), `missing: ${filePath}`).toBe(true);
    }
  });

  it("wires browser smoke through npm and env-aware Playwright config", () => {
    const packageJson = JSON.parse(readText("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["test:browser:smoke"]).toBe(
      "playwright test tests/browser/public-demo-smoke.spec.ts tests/browser/api-smoke.spec.ts",
    );

    const playwrightConfig = readText("playwright.config.ts");
    expect(playwrightConfig).toContain("PLAYWRIGHT_BASE_URL");
    expect(playwrightConfig).toContain("PLAYWRIGHT_SKIP_WEBSERVER");
    expect(playwrightConfig).toContain("useLocalWebServer");
  });

  it("uses a pinned auditable Factory Droid install path for wiki refresh", () => {
    const workflow = readText(".github/workflows/droid-wiki-refresh.yml");

    expect(workflow).toContain('FACTORY_DROID_VERSION: "0.141.1"');
    expect(workflow).toContain(
      "npm exec --yes --package=@factory/cli@${FACTORY_DROID_VERSION} -- droid --version",
    );
    expect(workflow).toContain("GH_TOKEN: ${{ github.token }}");
    expect(workflow).toContain(
      'npm exec --yes --package=@factory/cli@${FACTORY_DROID_VERSION} -- droid exec --cwd "$GITHUB_WORKSPACE" --auto high "/wiki"',
    );
    expect(workflow).not.toContain(
      "curl -fsSL https://app.factory.ai/cli | sh",
    );
  });

  it("expands safety and readiness scripts for hardening automation", () => {
    const readinessReport = readText("scripts/readiness-report.ts");
    expect(readinessReport).toContain(".github/workflows/qa.yml");
    expect(readinessReport).toContain(
      ".github/workflows/droid-wiki-refresh.yml",
    );
    expect(readinessReport).toContain("Readiness level:");
    expect(readinessReport).toContain(
      "No remote pipe-to-shell installer pattern detected",
    );

    const safetyScan = readText("scripts/demo-safety-scan.ts");
    expect(safetyScan).toContain(".next");
    expect(safetyScan).toContain("git log");
    expect(safetyScan).toContain("commit messages");
  });
});
