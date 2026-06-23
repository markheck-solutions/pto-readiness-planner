import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

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

type FileScanResult = {
  count: number;
  findings: Finding[];
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

export function safeReadText(filePath: string) {
  let fileDescriptor: number | null = null;

  try {
    fileDescriptor = fs.openSync(filePath, "r");
    const stat = fs.fstatSync(fileDescriptor);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;

    return fs.readFileSync(fileDescriptor, "utf8");
  } catch {
    return null;
  } finally {
    if (fileDescriptor !== null) {
      try {
        fs.closeSync(fileDescriptor);
      } catch {
        // The scan already treats unreadable files as skipped.
      }
    }
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

function readDirectoryEntries(directoryPath: string) {
  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function shouldSkipScanDirectory(directoryName: string) {
  return directoryName === "node_modules" || directoryName === ".git";
}

function collectWalkEntry(
  currentPath: string,
  entry: fs.Dirent,
  pendingDirectories: string[],
  resultFiles: string[],
) {
  const fullPath = path.join(currentPath, entry.name);

  if (entry.isDirectory()) {
    if (shouldSkipScanDirectory(entry.name)) return;
    pendingDirectories.push(fullPath);
    return;
  }

  if (entry.isFile()) {
    resultFiles.push(fullPath);
  }
}

function walkFiles(rootPath: string, opts?: { maxFiles?: number }) {
  const limit = opts?.maxFiles ?? 60_000;
  const results: string[] = [];
  const pending = [rootPath];

  while (pending.length > 0 && results.length < limit) {
    const current = pending.pop() as string;
    const entries = readDirectoryEntries(current);

    for (const entry of entries) {
      collectWalkEntry(current, entry, pending, results);
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

function printScanStart(startedAt: string, repoRoot: string) {
  printHeader("Demo safety scan");
  console.log(`Started: ${startedAt}`);
  console.log(`Repo: ${repoRoot}`);
}

function scanTrackedEnvFiles(findings: Finding[]) {
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
}

function collectFileFindings(
  scope: string,
  repoRoot: string,
  filePath: string,
  includeUnicodeDash: boolean,
) {
  const text = safeReadText(filePath);
  if (text === null) return [];

  const relativePath = normalizePath(path.relative(repoRoot, filePath));
  const patternFindings = collectPatternFindings(
    scope,
    relativePath,
    text,
    SECRET_PATTERNS,
  );

  if (!includeUnicodeDash) return patternFindings;
  return [
    ...collectUnicodeDashFinding(scope, relativePath, text),
    ...patternFindings,
  ];
}

function collectRepoFileScan(repoRoot: string): FileScanResult {
  const files = collectRepoFiles(repoRoot);
  const findings = files.flatMap((filePath) =>
    collectFileFindings("repo_file", repoRoot, filePath, true),
  );

  return { count: files.length, findings };
}

function scanRepoFiles(repoRoot: string, findings: Finding[]) {
  printHeader("Scan: source, docs, tests, scripts, skills, and public assets");
  console.log(`Repository roots: ${REPO_SCAN_ROOTS.join(", ")}`);
  console.log(`Review surfaces: ${REVIEW_SURFACES.join(", ")}`);
  const scan = collectRepoFileScan(repoRoot);
  findings.push(...scan.findings);
  console.log(`Scanned repo files: ${scan.count}`);
}

function collectOptionalFileScan(
  repoRoot: string,
  scope: string,
  roots: string[],
): FileScanResult {
  const files = collectOptionalFiles(repoRoot, roots);
  const findings = files.flatMap((filePath) =>
    collectFileFindings(scope, repoRoot, filePath, false),
  );

  return { count: files.length, findings };
}

function scanBuildAssets(repoRoot: string, findings: Finding[]) {
  printHeader("Scan: generated build assets");
  console.log(`Build roots: ${BUILD_SCAN_ROOTS.join(", ")}`);
  const scan = collectOptionalFileScan(
    repoRoot,
    "build_asset",
    BUILD_SCAN_ROOTS,
  );
  findings.push(...scan.findings);
  console.log(`Scanned build asset files: ${scan.count}`);
}

function scanArtifactFiles(repoRoot: string, findings: Finding[]) {
  printHeader("Scan: validation artifacts");
  console.log(`Artifact roots: ${ARTIFACT_SCAN_ROOTS.join(", ")}`);
  const scan = collectOptionalFileScan(
    repoRoot,
    "artifact_file",
    ARTIFACT_SCAN_ROOTS,
  );
  findings.push(...scan.findings);
  console.log(`Scanned artifact files: ${scan.count}`);
}

function readConfiguredCommitCount() {
  const rawCount = process.env.DEMO_SAFETY_COMMIT_COUNT ?? DEFAULT_COMMIT_COUNT;
  return Number(rawCount) || DEFAULT_COMMIT_COUNT;
}

function collectCommitMessageFindings(commitCount: number) {
  const gitLogResult = readCommitMessages(commitCount);

  if (!gitLogResult.ok) {
    return {
      scanned: false,
      findings: [
        {
          scope: "commit_messages",
          target: `last_${commitCount}_commits`,
          patternId: "git_log_unavailable",
          detail: `Could not scan commit messages: ${gitLogResult.error}`,
        },
      ] satisfies Finding[],
    };
  }

  return {
    scanned: true,
    findings: [
      ...collectUnicodeDashFinding(
        "commit_messages",
        `last_${commitCount}_commits`,
        gitLogResult.stdout,
      ),
      ...collectPatternFindings(
        "commit_messages",
        `last_${commitCount}_commits`,
        gitLogResult.stdout,
        SECRET_PATTERNS,
      ),
    ],
  };
}

function scanCommitMessages(findings: Finding[]) {
  printHeader("Scan: recent commit messages");
  const commitCount = readConfiguredCommitCount();
  const scan = collectCommitMessageFindings(commitCount);

  findings.push(...scan.findings);
  if (scan.scanned) {
    console.log(`Scanned commit messages: ${commitCount}`);
  }
}

function printScanResult(findings: Finding[]) {
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

async function main() {
  const startedAt = new Date().toISOString();
  const repoRoot = process.cwd();
  const findings: Finding[] = [];

  printScanStart(startedAt, repoRoot);
  scanTrackedEnvFiles(findings);
  scanRepoFiles(repoRoot, findings);
  scanBuildAssets(repoRoot, findings);
  scanArtifactFiles(repoRoot, findings);
  scanCommitMessages(findings);
  printScanResult(findings);
}

function isEntrypoint() {
  const scriptPath = process.argv[1];
  if (!scriptPath) return false;

  return import.meta.url === pathToFileURL(path.resolve(scriptPath)).href;
}

if (isEntrypoint()) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "demo-safety-scan failed.";
    console.error(message);
    process.exitCode = 1;
  });
}
