import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

type Finding = {
  file: string;
  kind: string;
  detail: string;
};

const NO_EM_DASH_REGEX = /[\u2013\u2014\u2015]/;

function run(cmd: string) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function safeReadText(filePath: string, maxBytes: number): string | null {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    if (stat.size > maxBytes) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function isTextFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
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
  ]).has(ext);
}

function printHeader(title: string) {
  console.log("");
  console.log("=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

function listTrackedFiles(): string[] {
  const out = run("git ls-files");
  return out
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((p) => p.replace(/\//g, path.sep));
}

async function main() {
  const startedAt = new Date().toISOString();

  printHeader("Demo safety scan");
  console.log(`Started: ${startedAt}`);
  console.log(`Repo: ${process.cwd()}`);

  const findings: Finding[] = [];

  printHeader("Tracked env file hygiene");
  const tracked = listTrackedFiles();
  const trackedEnv = tracked
    .filter((p) => path.basename(p).toLowerCase().startsWith(".env"))
    .map((p) => p.replace(/\\/g, "/"));
  const allowedEnv = new Set([".env.example"]);
  for (const f of trackedEnv) {
    if (!allowedEnv.has(f)) {
      findings.push({
        file: f,
        kind: "tracked_env_file",
        detail:
          "Only .env.example should be tracked. Remove other env files from git history and ensure .gitignore blocks them.",
      });
    }
  }
  console.log(`Tracked env-like files: ${trackedEnv.length}`);

  printHeader("Scan: tracked repo files (docs, code, templates)");
  const MAX_FILE_BYTES = 2_000_000;
  for (const relPath of tracked) {
    const filePath = path.join(process.cwd(), relPath);
    if (!isTextFile(filePath)) continue;

    const text = safeReadText(filePath, MAX_FILE_BYTES);
    if (text === null) continue;

    if (NO_EM_DASH_REGEX.test(text)) {
      findings.push({
        file: relPath.replace(/\\/g, "/"),
        kind: "forbidden_unicode_dash",
        detail:
          "Contains U+2013, U+2014, or U+2015. Use a plain hyphen instead.",
      });
    }

    if (relPath.replace(/\\/g, "/") === "README.md") {
      const forbidden: Array<{ kind: string; regex: RegExp; detail: string }> =
        [
          {
            kind: "readme_template_port",
            regex: /localhost:3000/i,
            detail: "README still mentions the default Next.js template port.",
          },
          {
            kind: "readme_non_npm_yarn",
            regex: /\byarn\b/i,
            detail: "README should not include yarn instructions.",
          },
          {
            kind: "readme_non_npm_pnpm",
            regex: /\bpnpm\b/i,
            detail: "README should not include pnpm instructions.",
          },
          {
            kind: "readme_non_npm_bun",
            regex: /\bbun\b/i,
            detail: "README should not include bun instructions.",
          },
        ];

      for (const f of forbidden) {
        if (f.regex.test(text)) {
          findings.push({
            file: "README.md",
            kind: f.kind,
            detail: f.detail,
          });
        }
      }
    }
  }

  printHeader("Result");
  if (findings.length === 0) {
    console.log("PASS: no demo safety violations detected.");
    return;
  }

  console.log(`FAIL: ${findings.length} finding(s) detected.`);
  for (const f of findings) {
    console.log(`- ${f.file} [${f.kind}] ${f.detail}`);
  }
  process.exitCode = 1;
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : "demo-safety-scan failed.";
  console.error(msg);
  process.exitCode = 1;
});
