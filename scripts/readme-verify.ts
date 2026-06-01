import fs from "node:fs";

type CheckResult = { ok: true } | { ok: false; reason: string };

const NO_EM_DASH_REGEX = /[\u2013\u2014\u2015]/; // en dash, em dash, horizontal bar

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

function requireIncludes(filePath: string, required: string[]): CheckResult[] {
  const results: CheckResult[] = [];
  if (!exists(filePath)) return [{ ok: false, reason: `Missing: ${filePath}` }];

  const t = readText(filePath);
  for (const r of required) {
    if (!t.includes(r))
      results.push({
        ok: false,
        reason: `${filePath} missing required text: ${JSON.stringify(r)}`,
      });
  }
  return results.length ? results : [{ ok: true }];
}

function forbidIncludes(
  filePath: string,
  forbidden: Array<{ label: string; regex: RegExp }>,
): CheckResult[] {
  const results: CheckResult[] = [];
  if (!exists(filePath)) return [{ ok: false, reason: `Missing: ${filePath}` }];

  const t = readText(filePath);
  for (const f of forbidden) {
    if (f.regex.test(t)) {
      results.push({
        ok: false,
        reason: `${filePath} contains forbidden content: ${f.label}`,
      });
    }
  }
  return results.length ? results : [{ ok: true }];
}

function checkNoEmDash(filePath: string): CheckResult {
  if (!exists(filePath)) return { ok: false, reason: `Missing: ${filePath}` };
  const t = readText(filePath);
  if (!NO_EM_DASH_REGEX.test(t)) return { ok: true };
  return {
    ok: false,
    reason: `${filePath} contains an em dash (U+2013/U+2014/U+2015). Use a plain hyphen or rewrite the sentence.`,
  };
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
  console.log(`README/template verification started: ${startedAt}`);
  console.log(`Repo: ${process.cwd()}`);

  const all: CheckResult[] = [];

  printHeader("Required files");
  const requiredFiles = [
    "README.md",
    "docs/runbooks/operations.md",
    "docs/validation/INDEX.md",
    ".github/CODEOWNERS",
    ".github/pull_request_template.md",
    ".github/ISSUE_TEMPLATE/bug_report.yml",
    ".github/ISSUE_TEMPLATE/readiness_task.yml",
  ];
  const fileChecks = requiredFiles.map(checkFilePresence);
  all.push(...fileChecks);
  const filesOk = summarize(fileChecks);

  printHeader("README content markers");
  const readmeChecks = requireIncludes("README.md", [
    "Quick start (local)",
    "Validation and readiness gates",
    "Repo maturity surfaces (external review)",
    "Default branch assumptions",
    "Secrets and demo safety",
    "http://127.0.0.1:3102",
  ]);
  all.push(...readmeChecks);
  const readmeOk = summarize(readmeChecks);

  printHeader("README forbidden template leftovers");
  const forbiddenReadme = forbidIncludes("README.md", [
    { label: "Default Next.js template port", regex: /localhost:3000/i },
    { label: "yarn instructions", regex: /\byarn\b/i },
    { label: "pnpm instructions", regex: /\bpnpm\b/i },
    { label: "bun instructions", regex: /\bbun\b/i },
  ]);
  all.push(...forbiddenReadme);
  const readmeForbiddenOk = summarize(forbiddenReadme);

  printHeader("Runbook content markers");
  const runbookChecks = requireIncludes("docs/runbooks/operations.md", [
    "Local startup",
    "Local verification",
    "Deployment (Vercel)",
    "Rollback",
    "GitHub Actions",
    "Default branch assumption",
    "Secret handling",
  ]);
  all.push(...runbookChecks);
  const runbookOk = summarize(runbookChecks);

  printHeader("No em dash characters in docs/templates");
  const noDashChecks = [
    "README.md",
    "docs/runbooks/operations.md",
    "docs/validation/INDEX.md",
    ".github/pull_request_template.md",
    ".github/ISSUE_TEMPLATE/bug_report.yml",
    ".github/ISSUE_TEMPLATE/readiness_task.yml",
  ].map(checkNoEmDash);
  all.push(...noDashChecks);
  const noDashOk = summarize(noDashChecks);

  printHeader("Result");
  const ok = filesOk && readmeOk && readmeForbiddenOk && runbookOk && noDashOk;
  if (ok) {
    console.log("PASS: README, runbook, and template surfaces look ready.");
    return;
  }

  console.log(
    "FAIL: docs/templates are missing required markers or contain invalid copy.",
  );
  process.exitCode = 1;
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : "readme-verify failed.";
  console.error(msg);
  process.exitCode = 1;
});
