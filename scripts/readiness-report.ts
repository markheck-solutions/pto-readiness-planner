import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import {
  buildAuditSection,
  normalizeExecOutput,
  type SafeRunResult,
  type SectionStatus,
} from "./readiness-report-lib";

type Section = {
  title: string;
  status: SectionStatus;
  lines: string[];
};

const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:3102";
const DEFAULT_BRANCH = "master";

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

function run(cmd: string) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function safeRun(cmd: string) {
  try {
    return {
      ok: true as const,
      stdout: run(cmd),
      stderr: "",
      exitCode: 0,
    } satisfies SafeRunResult;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "command failed";
    const failure = err as Partial<Error> & {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      status?: number | null;
    };

    const stdout = normalizeExecOutput(failure.stdout);
    const stderr = normalizeExecOutput(failure.stderr);
    const exitCode =
      typeof failure.status === "number" ? failure.status : undefined;

    return {
      ok: false as const,
      stdout,
      stderr,
      exitCode,
      error:
        typeof exitCode === "number" ? `exit code ${exitCode}: ${msg}` : msg,
    } satisfies SafeRunResult;
  }
}

function section(
  title: string,
  status: SectionStatus,
  lines: string[],
): Section {
  return { title, status, lines };
}

function printHeader(title: string) {
  console.log("");
  console.log("#".repeat(80));
  console.log(title);
  console.log("#".repeat(80));
}

function printSection(s: Section) {
  console.log("");
  console.log(`## ${s.title} [${s.status}]`);
  for (const line of s.lines) console.log(line);
}

function checkFileGate(files: string[]): {
  status: SectionStatus;
  lines: string[];
} {
  const missing = files.filter((f) => !exists(f));
  if (missing.length === 0) {
    return { status: "PASS", lines: files.map((f) => `- ${f}`) };
  }

  return {
    status: "FAIL",
    lines: [
      "- Missing:",
      ...missing.map((f) => `  - ${f}`),
      "",
      "- Present:",
      ...files.filter((f) => exists(f)).map((f) => `  - ${f}`),
    ],
  };
}

function checkWorkflowMarkers(
  filePath: string,
  requiredSubstrings: string[],
): { status: SectionStatus; lines: string[] } {
  if (!exists(filePath)) {
    return {
      status: "FAIL",
      lines: [`- Missing required workflow: ${filePath}`],
    };
  }

  const text = readText(filePath);
  const missing = requiredSubstrings.filter((marker) => !text.includes(marker));
  if (missing.length === 0) {
    return {
      status: "PASS",
      lines: [`- ${filePath} includes expected workflow markers`],
    };
  }

  return {
    status: "FAIL",
    lines: [
      `- ${filePath} is missing expected markers:`,
      ...missing.map((marker) => `  - ${marker}`),
    ],
  };
}

function checkWikiWorkflowGate(): {
  status: SectionStatus;
  lines: string[];
} {
  const filePath = ".github/workflows/droid-wiki-refresh.yml";
  if (!exists(filePath)) {
    return {
      status: "FAIL",
      lines: [`- Missing required workflow: ${filePath}`],
    };
  }

  const text = readText(filePath);
  const requiredSubstrings = [
    "workflow_dispatch",
    "master",
    "contents: write",
    "FACTORY_API_KEY",
    "npm ci",
    "/wiki",
  ];
  const missing = requiredSubstrings.filter((marker) => !text.includes(marker));
  const riskyPatterns = [
    "curl -fsSL https://app.factory.ai/cli | sh",
    "wget -qO- https://app.factory.ai/cli | sh",
  ].filter((pattern) => text.includes(pattern));
  const hasAuditableInstallPath =
    text.includes("@factory/cli@") ||
    /Factory-AI\/droid-action@[0-9a-f]{7,40}/i.test(text) ||
    text.includes("scripts/install-factory-droid") ||
    text.includes(".github/vendor/factory-droid");

  if (
    missing.length === 0 &&
    riskyPatterns.length === 0 &&
    hasAuditableInstallPath
  ) {
    return {
      status: "PASS",
      lines: [
        `- ${filePath} includes expected workflow markers`,
        "- Auditable Factory Droid install path detected",
        "- No remote pipe-to-shell installer pattern detected",
      ],
    };
  }

  const lines = [];

  if (missing.length > 0) {
    lines.push(`- ${filePath} is missing expected markers:`);
    lines.push(...missing.map((marker) => `  - ${marker}`));
  }

  if (riskyPatterns.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("- Unsafe remote installer patterns detected:");
    lines.push(...riskyPatterns.map((pattern) => `  - ${pattern}`));
  }

  if (!hasAuditableInstallPath) {
    if (lines.length > 0) lines.push("");
    lines.push("- No pinned or vendored Factory Droid install path detected.");
    lines.push(
      "  - Expected a pinned npm package, pinned GitHub Action ref, or vendored installer path.",
    );
  }

  return {
    status: "FAIL",
    lines,
  };
}

function checkTextIncludesGate(
  filePath: string,
  requiredSubstrings: string[],
): { status: SectionStatus; lines: string[] } {
  if (!exists(filePath)) {
    return {
      status: "FAIL",
      lines: [`- Missing required file: ${filePath}`],
    };
  }

  const t = readText(filePath);
  const missing = requiredSubstrings.filter((s) => !t.includes(s));
  if (missing.length === 0) {
    return {
      status: "PASS",
      lines: [`- ${filePath} includes expected markers`],
    };
  }

  return {
    status: "FAIL",
    lines: [
      `- ${filePath} missing expected markers:`,
      ...missing.map((m) => `  - ${m}`),
    ],
  };
}

function readPackageJsonScripts():
  | {
      ok: true;
      scripts: Record<string, string>;
    }
  | { ok: false; reason: string } {
  const p = "package.json";
  if (!exists(p)) return { ok: false, reason: "Missing: package.json" };
  try {
    const parsed = JSON.parse(readText(p)) as {
      scripts?: Record<string, string>;
    };
    return { ok: true, scripts: parsed.scripts ?? {} };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to parse package.json";
    return { ok: false, reason: msg };
  }
}

function normalizeSlashes(p: string) {
  return p.replace(/\\/g, "/");
}

function listWorkflowYamlFiles(): string[] {
  const dir = path.join(process.cwd(), ".github", "workflows");
  if (!exists(dir)) return [];
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && /\.ya?ml$/i.test(d.name))
      .map((d) => normalizeSlashes(path.join(".github", "workflows", d.name)));
  } catch {
    return [];
  }
}

function workflowBranchAssumptionChecks(): {
  status: SectionStatus;
  lines: string[];
} {
  const workflowFiles = listWorkflowYamlFiles();
  if (workflowFiles.length === 0) {
    return {
      status: "FAIL",
      lines: ["- Missing: .github/workflows/*.yml", "- Expected at least: CI"],
    };
  }

  const findings: string[] = [];
  const failures: string[] = [];

  for (const f of workflowFiles) {
    const text = readText(f);
    const hasBranchFilter =
      /branches:\s*(?:\[[^\]]*\]|[\s\S]*?\n\s*-\s*\w+)/m.test(text);
    const mentionsMaster = text.includes(DEFAULT_BRANCH);

    findings.push(`- ${f}`);
    if (hasBranchFilter && !mentionsMaster) {
      failures.push(
        `${f} uses branch filters but does not mention '${DEFAULT_BRANCH}'.`,
      );
    }
  }

  if (failures.length === 0) {
    return {
      status: "PASS",
      lines: [
        "- Default branch assumption:",
        `  - Workflows are currently wired to '${DEFAULT_BRANCH}'.`,
        "  - If the remote default branch changes, a repo owner/admin must update branch filters in workflow YAML files.",
        "",
        "- Workflows checked:",
        ...findings,
      ],
    };
  }

  return {
    status: "FAIL",
    lines: [
      "- Default branch assumption mismatch:",
      ...failures.map((f) => `  - ${f}`),
      "",
      "- Action:",
      `  - If the remote default branch is still '${DEFAULT_BRANCH}', restore branch filters.`,
      "  - If the remote default branch changed, update workflow branch filters and update this readiness report's DEFAULT_BRANCH constant.",
    ],
  };
}

function computeReadinessLevel(sections: Section[]): number {
  const failed = sections.some((section) => section.status === "FAIL");
  if (failed) return 0;

  const requiredForLevelFour = new Set([
    "Local validation commands (npm scripts)",
    "CI validation wiring",
    "QA workflow wiring",
    "CodeQL workflow",
    "Wiki refresh workflow",
    "Dependabot configuration",
    "QA skill surfaces",
    "Docs and reviewer surfaces present",
    "Environment contract (.env.example)",
    "Secret hygiene (.gitignore)",
    "Playwright smoke flexibility",
    "Safety scan coverage",
  ]);

  const hasAllLevelFourRequirements = sections.every((section) => {
    if (!requiredForLevelFour.has(section.title)) return true;
    return section.status === "PASS";
  });

  if (hasAllLevelFourRequirements) return 4;
  return 3;
}

async function main() {
  const startedAt = new Date().toISOString();

  const commit = safeRun("git rev-parse HEAD");
  const sha = commit.ok ? commit.stdout.trim() : "unknown";

  printHeader("Readiness report (repo maturity)");
  console.log(`Started: ${startedAt}`);
  console.log(`Base URL (local): ${DEFAULT_LOCAL_BASE_URL}`);
  console.log(`Default branch assumption: ${DEFAULT_BRANCH}`);
  console.log(`Repo: ${process.cwd()}`);
  console.log(`Commit: ${sha}`);

  const sections: Section[] = [];

  sections.push(
    section("Install expectation mapping", "PASS", [
      "- /install-qa equivalent:",
      "  - .factory/skills/qa plus qa-web and qa-api",
      "  - .github/workflows/qa.yml for local regression and optional production smoke",
      "- /install-wiki equivalent:",
      "  - .github/workflows/droid-wiki-refresh.yml",
      "- /readiness-report equivalent:",
      "  - npm script: npm run readiness-report",
      "  - implementation: scripts/readiness-report.ts",
    ]),
  );

  // Local validation command inventory
  const scriptInventory = readPackageJsonScripts();
  if (!scriptInventory.ok) {
    sections.push(
      section("Local validation commands (npm scripts)", "FAIL", [
        `- ${scriptInventory.reason}`,
      ]),
    );
  } else {
    const requiredScripts = [
      "format:check",
      "lint",
      "typecheck",
      "test:coverage",
      "build",
      "safety",
      "quality:check",
      "readme:verify",
      "readiness-report",
      "test:browser",
      "test:browser:smoke",
      "db:seed",
    ];

    const missing = requiredScripts.filter(
      (name) => !scriptInventory.scripts[name],
    );
    sections.push(
      section(
        "Local validation commands (npm scripts)",
        missing.length === 0 ? "PASS" : "FAIL",
        missing.length === 0
          ? [
              "- Required scripts present:",
              ...requiredScripts.map((n) => `  - npm run ${n}`),
            ]
          : [
              "- Missing required scripts:",
              ...missing.map((n) => `  - ${n}`),
              "",
              "- Action:",
              "  - Add the missing scripts to package.json so CI and reviewers can run consistent gates.",
            ],
      ),
    );
  }

  // CI present
  const ciGate = checkWorkflowMarkers(".github/workflows/ci.yml", [
    "npm ci",
    "npm run format:check",
    "npm run lint",
    "npm run typecheck",
    "npm run test:coverage",
    "npm run build",
    "npm run safety",
    "npm run quality:check",
    "npm run readme:verify",
    "npm run readiness-report",
  ]);
  sections.push(section("CI validation wiring", ciGate.status, ciGate.lines));

  const qaWorkflow = checkWorkflowMarkers(".github/workflows/qa.yml", [
    "workflow_dispatch",
    "base_url",
    "npm ci",
    "npx playwright install chromium --with-deps",
    "npm run test:browser",
    "npm run test:browser:smoke",
    "PLAYWRIGHT_BASE_URL",
    "PLAYWRIGHT_SKIP_WEBSERVER",
    "master",
  ]);
  sections.push(
    section("QA workflow wiring", qaWorkflow.status, qaWorkflow.lines),
  );

  const codeql = checkWorkflowMarkers(".github/workflows/codeql.yml", [
    "security-events: write",
    "github/codeql-action/init@v4",
    "javascript-typescript",
    "master",
  ]);
  sections.push(section("CodeQL workflow", codeql.status, codeql.lines));

  const wikiWorkflow = checkWikiWorkflowGate();
  sections.push(
    section("Wiki refresh workflow", wikiWorkflow.status, wikiWorkflow.lines),
  );

  const dependabot = checkTextIncludesGate(".github/dependabot.yml", [
    'package-ecosystem: "npm"',
    'package-ecosystem: "github-actions"',
    'interval: "weekly"',
  ]);
  sections.push(
    section("Dependabot configuration", dependabot.status, dependabot.lines),
  );

  const branchAssumption = workflowBranchAssumptionChecks();
  sections.push(
    section(
      "Workflow default branch assumptions",
      branchAssumption.status,
      branchAssumption.lines,
    ),
  );

  // Docs + reviewer surfaces
  const docGate = checkFileGate([
    "README.md",
    "docs/runbooks/operations.md",
    "docs/validation/INDEX.md",
    ".github/CODEOWNERS",
    ".github/pull_request_template.md",
    ".github/ISSUE_TEMPLATE/bug_report.yml",
    ".github/ISSUE_TEMPLATE/readiness_task.yml",
  ]);
  sections.push(
    section(
      "Docs and reviewer surfaces present",
      docGate.status,
      docGate.lines,
    ),
  );

  // Env contract + ignore markers
  const envGate = checkTextIncludesGate(".env.example", [
    "NEXT_PUBLIC_DEMO_MODE=true",
    "AI_PROVIDER=mock",
    "DATABASE_URL=",
    "OPENAI_COMPATIBLE_BASE_URL=",
    "OPENAI_COMPATIBLE_API_KEY=",
    "OPENAI_COMPATIBLE_MODEL=",
    "OPENAI_COMPATIBLE_MODEL=",
  ]);
  sections.push(
    section(
      "Environment contract (.env.example)",
      envGate.status,
      envGate.lines,
    ),
  );

  const ignoreGate = checkTextIncludesGate(".gitignore", [
    ".env*",
    "!.env.example",
  ]);
  sections.push(
    section("Secret hygiene (.gitignore)", ignoreGate.status, ignoreGate.lines),
  );

  const qaSkillGate = checkFileGate([
    ".factory/skills/qa/SKILL.md",
    ".factory/skills/qa/config.yaml",
    ".factory/skills/qa/REPORT-TEMPLATE.md",
    ".factory/skills/qa-web/SKILL.md",
    ".factory/skills/qa-api/SKILL.md",
  ]);
  sections.push(
    section("QA skill surfaces", qaSkillGate.status, qaSkillGate.lines),
  );

  const playwrightLines: string[] = [];
  const playwrightFailures: string[] = [];
  const packageScripts = readPackageJsonScripts();
  if (!packageScripts.ok) {
    playwrightFailures.push(packageScripts.reason);
  } else if (!packageScripts.scripts["test:browser:smoke"]) {
    playwrightFailures.push("package.json missing script: test:browser:smoke");
  } else {
    playwrightLines.push("- package.json includes npm run test:browser:smoke");
  }

  const playwrightConfigGate = checkTextIncludesGate("playwright.config.ts", [
    "PLAYWRIGHT_BASE_URL",
    "PLAYWRIGHT_SKIP_WEBSERVER",
  ]);
  if (playwrightConfigGate.status === "FAIL") {
    playwrightFailures.push(
      ...playwrightConfigGate.lines.map((line) => line.replace(/^- /, "")),
    );
  } else {
    playwrightLines.push(...playwrightConfigGate.lines);
  }
  sections.push(
    section(
      "Playwright smoke flexibility",
      playwrightFailures.length === 0 ? "PASS" : "FAIL",
      playwrightFailures.length === 0
        ? playwrightLines
        : playwrightFailures.map((line) => `- ${line}`),
    ),
  );

  const safetyCoverage = checkTextIncludesGate("scripts/demo-safety-scan.ts", [
    "REPO_SCAN_ROOTS",
    ".factory",
    "BUILD_SCAN_ROOTS",
    ".next/static",
    "ARTIFACT_SCAN_ROOTS",
    "commit messages",
    "git log",
  ]);
  sections.push(
    section(
      "Safety scan coverage",
      safetyCoverage.status,
      safetyCoverage.lines,
    ),
  );

  // npm audit triage
  const audit = safeRun("npm audit --json");
  const auditSection = buildAuditSection(audit);
  sections.push(
    section(
      "Dependency audit (npm audit)",
      auditSection.status,
      auditSection.lines,
    ),
  );

  for (const s of sections) printSection(s);

  printHeader("Final status");
  const failed = sections.filter((s) => s.status === "FAIL");
  const level = computeReadinessLevel(sections);

  console.log(`Readiness level: ${level}`);

  if (failed.length === 0 && level >= 3) {
    console.log("PASS: readiness-report gates satisfied.");
    return;
  }

  if (failed.length === 0) {
    console.log(
      "FAIL: readiness level did not reach 3 or 4 even though no section failed.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`FAIL: ${failed.length} section(s) failed.`);
  console.log("Fix the failures above and rerun: npm run readiness-report");
  process.exitCode = 1;
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : "readiness-report failed.";
  console.error(msg);
  process.exitCode = 1;
});
