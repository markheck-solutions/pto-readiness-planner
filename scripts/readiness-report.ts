import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

type SectionStatus = "PASS" | "WARN" | "FAIL";

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
    return { ok: true as const, stdout: run(cmd) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "command failed";
    return { ok: false as const, stdout: "", error: msg };
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

function checkFileGate(
  files: string[],
  opts?: { allowMissing?: boolean },
): {
  status: SectionStatus;
  lines: string[];
} {
  const allowMissing = opts?.allowMissing ?? false;
  const missing = files.filter((f) => !exists(f));
  if (missing.length === 0)
    return { status: "PASS", lines: files.map((f) => `- ${f}`) };

  return {
    status: allowMissing ? "WARN" : "FAIL",
    lines: [
      "- Missing:",
      ...missing.map((f) => `  - ${f}`),
      "",
      "- Present:",
      ...files.filter((f) => exists(f)).map((f) => `  - ${f}`),
    ],
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

function parseAuditCounts(jsonText: string): {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
} {
  type AuditJson = {
    metadata?: {
      vulnerabilities?: Partial<{
        total: number;
        critical: number;
        high: number;
        moderate: number;
        low: number;
      }>;
    };
  };

  const parsed = JSON.parse(jsonText) as AuditJson;
  const v = parsed.metadata?.vulnerabilities;
  return {
    total: Number(v?.total ?? 0),
    critical: Number(v?.critical ?? 0),
    high: Number(v?.high ?? 0),
    moderate: Number(v?.moderate ?? 0),
    low: Number(v?.low ?? 0),
  };
}

function computeReadinessLevel(sections: Section[]): number {
  const hasDocs = sections.some(
    (s) =>
      s.title === "Docs and reviewer surfaces present" && s.status === "PASS",
  );
  const hasCi = sections.some(
    (s) => s.title === "CI workflow present" && s.status === "PASS",
  );
  const hasScripts = sections.some(
    (s) =>
      s.title === "Local validation commands (npm scripts)" &&
      s.status === "PASS",
  );

  if (!hasDocs || !hasCi) return 1;
  if (!hasScripts) return 2;

  // Level 3+ requires QA/wiki automation which is intentionally deferred.
  return 2;
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
      "- /install-qa equivalent: deferred to hardening milestone",
      "- /install-wiki equivalent: deferred to hardening milestone",
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
  const ciGate = checkFileGate([".github/workflows/ci.yml"]);
  sections.push(section("CI workflow present", ciGate.status, ciGate.lines));

  // Deferred maturity surfaces (WARN for now)
  const deferred = checkFileGate(
    [
      ".github/workflows/codeql.yml",
      ".github/workflows/qa.yml",
      ".github/workflows/droid-wiki-refresh.yml",
      ".github/dependabot.yml",
    ],
    { allowMissing: true },
  );
  sections.push(
    section("Deferred automation (hardening milestone)", deferred.status, [
      ...deferred.lines,
      "",
      "- Note:",
      "  - CodeQL, Dependabot, QA workflow, and wiki refresh are intentionally not required for this scaffold feature.",
    ]),
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
    "OPENAI_COMPATIBLE_API_KEY=",
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

  // npm audit triage
  const audit = safeRun("npm audit --json");
  if (!audit.ok) {
    sections.push(
      section("Dependency audit (npm audit)", "WARN", [
        "- npm audit failed to produce JSON output.",
        `- Error: ${audit.error}`,
        "- Action: run `npm audit` locally to view the report.",
      ]),
    );
  } else {
    const counts = parseAuditCounts(audit.stdout);
    const status: SectionStatus =
      counts.critical > 0 || counts.high > 0
        ? "FAIL"
        : counts.total > 0
          ? "WARN"
          : "PASS";

    const lines = [
      "- Vulnerability counts:",
      `  - critical: ${counts.critical}`,
      `  - high: ${counts.high}`,
      `  - moderate: ${counts.moderate}`,
      `  - low: ${counts.low}`,
      `  - total: ${counts.total}`,
    ];

    if (status !== "PASS") {
      lines.push("");
      lines.push("- Follow-up:");
      if (counts.critical > 0 || counts.high > 0) {
        lines.push(
          "  - Remediate critical or high vulnerabilities or gate releases until resolved.",
        );
      } else {
        lines.push(
          "  - Review moderate or low findings and plan upgrades where feasible.",
        );
      }
    }

    sections.push(section("Dependency audit (npm audit)", status, lines));
  }

  for (const s of sections) printSection(s);

  printHeader("Final status");
  const failed = sections.filter((s) => s.status === "FAIL");
  const level = computeReadinessLevel(sections);

  console.log(`Readiness level (scaffold): ${level}`);

  if (failed.length === 0) {
    console.log("PASS: readiness-report gates satisfied for this scaffold.");
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
