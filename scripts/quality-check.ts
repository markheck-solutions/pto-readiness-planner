import fs from "node:fs";

type CheckResult = { ok: true } | { ok: false; reason: string };

function exists(p: string) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readText(p: string) {
  return fs.readFileSync(p, "utf8");
}

function checkFilePresence(relPath: string): CheckResult {
  if (!exists(relPath)) return { ok: false, reason: `Missing: ${relPath}` };
  return { ok: true };
}

function checkNpmOnly(): CheckResult[] {
  const disallowed = [
    "yarn.lock",
    "pnpm-lock.yaml",
    "pnpm-lock.yml",
    "bun.lock",
    "bun.lockb",
  ];

  const results: CheckResult[] = [];

  results.push(checkFilePresence("package.json"));
  results.push(checkFilePresence("package-lock.json"));

  for (const f of disallowed) {
    if (exists(f)) results.push({ ok: false, reason: `Disallowed file: ${f}` });
  }

  return results;
}

function checkCoverageIgnored(): CheckResult[] {
  const results: CheckResult[] = [];

  const prettierIgnore = ".prettierignore";
  if (!exists(prettierIgnore)) {
    results.push({ ok: false, reason: "Missing: .prettierignore" });
  } else {
    const t = readText(prettierIgnore);
    for (const required of ["coverage", ".next", "node_modules"]) {
      if (!t.includes(required)) {
        results.push({
          ok: false,
          reason: `.prettierignore missing ignore entry for: ${required}`,
        });
      }
    }
  }

  const eslintConfig = "eslint.config.mjs";
  if (!exists(eslintConfig)) {
    results.push({ ok: false, reason: "Missing: eslint.config.mjs" });
  } else {
    const t = readText(eslintConfig);
    for (const required of ["coverage/**", ".next/**"]) {
      if (!t.includes(required)) {
        results.push({
          ok: false,
          reason: `eslint.config.mjs missing ignore entry for: ${required}`,
        });
      }
    }
  }

  return results;
}

function checkMaturityArtifacts(): CheckResult[] {
  const results: CheckResult[] = [];
  const required = [
    ".github/workflows/ci.yml",
    ".github/workflows/qa.yml",
    ".github/workflows/codeql.yml",
    ".github/workflows/droid-wiki-refresh.yml",
    ".github/dependabot.yml",
    ".github/CODEOWNERS",
    ".github/pull_request_template.md",
    ".github/ISSUE_TEMPLATE/bug_report.yml",
    ".github/ISSUE_TEMPLATE/readiness_task.yml",
    ".factory/skills/qa/SKILL.md",
    ".factory/skills/qa/config.yaml",
    ".factory/skills/qa/REPORT-TEMPLATE.md",
    ".factory/skills/qa-web/SKILL.md",
    ".factory/skills/qa-api/SKILL.md",
    "docs/runbooks/operations.md",
    "docs/validation/INDEX.md",
    "scripts/readme-verify.ts",
    "scripts/readiness-report.ts",
    "scripts/demo-safety-scan.ts",
  ];

  for (const p of required) results.push(checkFilePresence(p));
  return results;
}

function checkQaSmokeWiring(): CheckResult[] {
  const results: CheckResult[] = [];

  if (!exists("package.json")) {
    results.push({ ok: false, reason: "Missing: package.json" });
    return results;
  }

  try {
    const packageJson = JSON.parse(readText("package.json")) as {
      scripts?: Record<string, string>;
    };
    const smokeScript = packageJson.scripts?.["test:browser:smoke"];
    if (!smokeScript) {
      results.push({
        ok: false,
        reason: "package.json missing script: test:browser:smoke",
      });
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to parse package.json";
    results.push({ ok: false, reason: message });
  }

  const playwrightConfig = "playwright.config.ts";
  if (!exists(playwrightConfig)) {
    results.push({ ok: false, reason: `Missing: ${playwrightConfig}` });
  } else {
    const text = readText(playwrightConfig);
    for (const marker of ["PLAYWRIGHT_BASE_URL", "PLAYWRIGHT_SKIP_WEBSERVER"]) {
      if (!text.includes(marker)) {
        results.push({
          ok: false,
          reason: `playwright.config.ts missing smoke marker: ${marker}`,
        });
      }
    }
  }

  return results;
}

function checkComplexityGateWiring(): CheckResult[] {
  const results: CheckResult[] = [];

  if (!exists("package.json")) {
    results.push({ ok: false, reason: "Missing: package.json" });
    return results;
  }

  try {
    const packageJson = JSON.parse(readText("package.json")) as {
      scripts?: Record<string, string>;
    };
    const script = packageJson.scripts?.["complexity:check"];
    const requiredMarkers = [
      "eslint",
      "complexity",
      "app/**/*.{ts,tsx}",
      "src/**/*.ts",
      "scripts/**/*.ts",
    ];

    if (!script) {
      results.push({
        ok: false,
        reason: "package.json missing script: complexity:check",
      });
    } else {
      for (const marker of requiredMarkers) {
        if (!script.includes(marker)) {
          results.push({
            ok: false,
            reason: `complexity:check missing marker: ${marker}`,
          });
        }
      }
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to parse package.json";
    results.push({ ok: false, reason: message });
  }

  const ciWorkflow = ".github/workflows/ci.yml";
  if (!exists(ciWorkflow)) {
    results.push({ ok: false, reason: `Missing: ${ciWorkflow}` });
  } else if (!readText(ciWorkflow).includes("npm run complexity:check")) {
    results.push({
      ok: false,
      reason: "ci.yml missing npm run complexity:check",
    });
  }

  return results;
}

function printHeader(title: string) {
  console.log("");
  console.log("=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

function summarize(results: CheckResult[]) {
  const failures = results.filter((r) => !r.ok) as Array<
    Extract<CheckResult, { ok: false }>
  >;
  if (failures.length === 0) {
    console.log("PASS");
    return true;
  }

  console.log(`FAIL (${failures.length} issue(s))`);
  for (const f of failures) console.log(`- ${f.reason}`);
  return false;
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`Quality check started: ${startedAt}`);
  console.log(`Repo: ${process.cwd()}`);
  console.log(`Node: ${process.version}`);

  const all: CheckResult[] = [];

  printHeader("Npm-only contract");
  const npmOnly = checkNpmOnly();
  all.push(...npmOnly);
  const npmOnlyOk = summarize(npmOnly);

  printHeader("Coverage and build artifact ignores");
  const ignores = checkCoverageIgnored();
  all.push(...ignores);
  const ignoresOk = summarize(ignores);

  printHeader("Maturity artifacts presence");
  const artifacts = checkMaturityArtifacts();
  all.push(...artifacts);
  const artifactsOk = summarize(artifacts);

  printHeader("QA smoke wiring");
  const qaSmoke = checkQaSmokeWiring();
  all.push(...qaSmoke);
  const qaSmokeOk = summarize(qaSmoke);

  printHeader("Complexity gate wiring");
  const complexity = checkComplexityGateWiring();
  all.push(...complexity);
  const complexityOk = summarize(complexity);

  printHeader("Result");
  if (npmOnlyOk && ignoresOk && artifactsOk && qaSmokeOk && complexityOk) {
    console.log("PASS: quality gates satisfied.");
    return;
  }

  console.log("FAIL: quality gates missing required artifacts.");
  process.exitCode = 1;
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : "quality-check failed.";
  console.error(msg);
  process.exitCode = 1;
});
