import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

type Pattern = {
  id: string;
  description: string;
  regex: RegExp;
};

type Finding = {
  scope: string;
  target: string;
  patternId: string;
  detail: string;
  match?: string;
};

const NO_EM_DASH_REGEX = /[\u2013\u2014\u2015]/;
const MAX_FILE_BYTES = 2_000_000;
const DEFAULT_COMMIT_COUNT = 50;

const TEXT_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonl",
  ".md",
  ".txt",
  ".yml",
  ".yaml",
  ".css",
  ".html",
  ".svg",
  ".xml",
  ".map",
  ".ps1",
  ".sh",
  ".toml",
  ".env",
]);

const SECRET_PATTERNS: Pattern[] = [
  {
    id: "database_connection_string",
    description: "Contains a database connection string.",
    regex: /\bpostgres(?:ql)?:\/\/[^/\s:@]+(?::[^/\s@]+)?@[^/\s]+/i,
  },
  {
    id: "openai_compatible_api_key_value",
    description: "Contains a non-empty OPENAI-compatible API key assignment.",
    regex:
      /OPENAI_COMPATIBLE_API_KEY\s*[:=]\s*["']?(?!["']?$|placeholder|changeme|set-me|example|local-test-key|test-key|dummy-key)[A-Za-z0-9._-]{8,}/i,
  },
  {
    id: "openai_compatible_non_local_url",
    description: "Contains a non-local OPENAI-compatible base URL assignment.",
    regex:
      /OPENAI_COMPATIBLE_BASE_URL\s*[:=]\s*["']?https?:\/\/(?!127\.0\.0\.1|localhost|0\.0\.0\.0|example\.com|example\.test)[^"' \r\n]+/i,
  },
  {
    id: "openai_style_token",
    description: "Contains an OpenAI-style secret token.",
    regex: /\bsk-[A-Za-z0-9_-]{16,}\b/,
  },
  {
    id: "github_pat",
    description: "Contains a GitHub personal access token.",
    regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  },
  {
    id: "aws_access_key",
    description: "Contains an AWS access key identifier.",
    regex: /\bAKIA[0-9A-Z]{16}\b/,
  },
];

const REPO_SCAN_ROOTS = [
  "app",
  "src",
  "scripts",
  "tests",
  "docs",
  "public",
  ".github",
  ".factory",
];

const REVIEW_SURFACES = [
  "README.md",
  ".env.example",
  ".gitignore",
  "package.json",
  "playwright.config.ts",
];

const BUILD_SCAN_ROOTS = [".next/static", ".next/server"];
const ARTIFACT_SCAN_ROOTS = ["coverage", "test-results", "playwright-report"];

function run(command: string) {
  return execSync(command, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function safeRun(command: string) {
  try {
    return { ok: true as const, stdout: run(command) };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "command execution failed";
    return { ok: false as const, stdout: "", error: message };
  }
}

function exists(filePath: string) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isTextFile(filePath: string) {
  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function safeReadText(filePath: string) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function printHeader(title: string) {
  console.log("");
  console.log("=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

function walkFiles(rootPath: string, opts?: { maxFiles?: number }) {
  const limit = opts?.maxFiles ?? 60_000;
  const results: string[] = [];
  const pending = [rootPath];

  while (pending.length > 0 && results.length < limit) {
    const current = pending.pop();
    if (!current) continue;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        pending.push(fullPath);
        continue;
      }

      if (entry.isFile()) {
        results.push(fullPath);
      }

      if (results.length >= limit) break;
    }
  }

  return results;
}

function listTrackedFiles() {
  const result = safeRun("git ls-files");
  if (!result.ok) return [];

  return result.stdout
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((filePath) => filePath.replace(/\//g, path.sep));
}

function summarizeMatch(match: string) {
  const condensed = match.replace(/\s+/g, " ").trim();
  if (condensed.length <= 160) return condensed;
  return `${condensed.slice(0, 160)}...`;
}

function collectPatternFindings(
  scope: string,
  target: string,
  text: string,
  patterns: Pattern[],
) {
  const findings: Finding[] = [];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (!match) continue;

    findings.push({
      scope,
      target,
      patternId: pattern.id,
      detail: pattern.description,
      match: summarizeMatch(match[0] ?? ""),
    });
  }

  return findings;
}

function collectUnicodeDashFinding(
  scope: string,
  target: string,
  text: string,
) {
  if (!NO_EM_DASH_REGEX.test(text)) return [];

  return [
    {
      scope,
      target,
      patternId: "forbidden_unicode_dash",
      detail: "Contains U+2013, U+2014, or U+2015. Use a plain hyphen instead.",
    },
  ] satisfies Finding[];
}

function uniqueFiles(filePaths: string[]) {
  return [...new Set(filePaths.map((filePath) => normalizePath(filePath)))].map(
    (filePath) => filePath.replace(/\//g, path.sep),
  );
}

function collectRepoFiles(repoRoot: string) {
  const files: string[] = [];

  for (const root of REPO_SCAN_ROOTS) {
    const absoluteRoot = path.join(repoRoot, root);
    if (!exists(absoluteRoot)) continue;
    files.push(...walkFiles(absoluteRoot));
  }

  for (const reviewSurface of REVIEW_SURFACES) {
    const absolutePath = path.join(repoRoot, reviewSurface);
    if (!exists(absolutePath)) continue;
    files.push(absolutePath);
  }

  return uniqueFiles(files).filter(isTextFile);
}

function collectOptionalFiles(repoRoot: string, roots: string[]) {
  const files: string[] = [];

  for (const root of roots) {
    const absoluteRoot = path.join(repoRoot, root);
    if (!exists(absoluteRoot)) continue;
    files.push(...walkFiles(absoluteRoot, { maxFiles: 120_000 }));
  }

  return uniqueFiles(files).filter(isTextFile);
}

function readCommitMessages(limit: number) {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  return safeRun(`git log -n ${safeLimit} --pretty=format:%h%x00%s%x00%b`);
}

function printFinding(finding: Finding) {
  console.log(`- [${finding.scope}] ${finding.target}`);
  console.log(`  - ${finding.patternId}: ${finding.detail}`);
  if (finding.match) {
    console.log(`  - match: ${finding.match}`);
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const repoRoot = process.cwd();

  printHeader("Demo safety scan");
  console.log(`Started: ${startedAt}`);
  console.log(`Repo: ${repoRoot}`);

  const findings: Finding[] = [];

  printHeader("Tracked env file hygiene");
  const trackedFiles = listTrackedFiles();
  const trackedEnvFiles = trackedFiles
    .filter((filePath) =>
      path.basename(filePath).toLowerCase().startsWith(".env"),
    )
    .map((filePath) => normalizePath(filePath));

  for (const filePath of trackedEnvFiles) {
    if (filePath === ".env.example") continue;
    findings.push({
      scope: "tracked_files",
      target: filePath,
      patternId: "tracked_env_file",
      detail:
        "Only .env.example should be tracked. Remove other env files from git history and keep them ignored locally.",
    });
  }

  console.log(`Tracked env-like files: ${trackedEnvFiles.length}`);

  printHeader("Scan: source, docs, tests, scripts, skills, and public assets");
  console.log(`Repository roots: ${REPO_SCAN_ROOTS.join(", ")}`);
  console.log(`Review surfaces: ${REVIEW_SURFACES.join(", ")}`);
  const repoFiles = collectRepoFiles(repoRoot);

  for (const filePath of repoFiles) {
    const text = safeReadText(filePath);
    if (text === null) continue;

    const relativePath = normalizePath(path.relative(repoRoot, filePath));
    findings.push(
      ...collectUnicodeDashFinding("repo_file", relativePath, text),
    );
    findings.push(
      ...collectPatternFindings(
        "repo_file",
        relativePath,
        text,
        SECRET_PATTERNS,
      ),
    );
  }

  console.log(`Scanned repo files: ${repoFiles.length}`);

  printHeader("Scan: generated build assets");
  console.log(`Build roots: ${BUILD_SCAN_ROOTS.join(", ")}`);
  const buildFiles = collectOptionalFiles(repoRoot, BUILD_SCAN_ROOTS);
  for (const filePath of buildFiles) {
    const text = safeReadText(filePath);
    if (text === null) continue;

    const relativePath = normalizePath(path.relative(repoRoot, filePath));
    findings.push(
      ...collectPatternFindings(
        "build_asset",
        relativePath,
        text,
        SECRET_PATTERNS,
      ),
    );
  }
  console.log(`Scanned build asset files: ${buildFiles.length}`);

  printHeader("Scan: validation artifacts");
  console.log(`Artifact roots: ${ARTIFACT_SCAN_ROOTS.join(", ")}`);
  const artifactFiles = collectOptionalFiles(repoRoot, ARTIFACT_SCAN_ROOTS);
  for (const filePath of artifactFiles) {
    const text = safeReadText(filePath);
    if (text === null) continue;

    const relativePath = normalizePath(path.relative(repoRoot, filePath));
    findings.push(
      ...collectPatternFindings(
        "artifact_file",
        relativePath,
        text,
        SECRET_PATTERNS,
      ),
    );
  }
  console.log(`Scanned artifact files: ${artifactFiles.length}`);

  printHeader("Scan: recent commit messages");
  const commitCount =
    Number(process.env.DEMO_SAFETY_COMMIT_COUNT ?? `${DEFAULT_COMMIT_COUNT}`) ||
    DEFAULT_COMMIT_COUNT;
  const gitLogResult = readCommitMessages(commitCount);

  if (gitLogResult.ok) {
    findings.push(
      ...collectUnicodeDashFinding(
        "commit_messages",
        `last_${commitCount}_commits`,
        gitLogResult.stdout,
      ),
    );
    findings.push(
      ...collectPatternFindings(
        "commit_messages",
        `last_${commitCount}_commits`,
        gitLogResult.stdout,
        SECRET_PATTERNS,
      ),
    );
    console.log(`Scanned commit messages: ${commitCount}`);
  } else {
    findings.push({
      scope: "commit_messages",
      target: `last_${commitCount}_commits`,
      patternId: "git_log_unavailable",
      detail: `Could not scan commit messages: ${gitLogResult.error}`,
    });
  }

  printHeader("Result");
  if (findings.length === 0) {
    console.log(
      "PASS: scanned source, docs, tests, seed surfaces, public assets, build assets, artifacts, and commit messages without safety violations.",
    );
    return;
  }

  console.log(`FAIL: ${findings.length} finding(s) detected.`);
  for (const finding of findings) {
    printFinding(finding);
  }
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "demo-safety-scan failed.";
  console.error(message);
  process.exitCode = 1;
});
