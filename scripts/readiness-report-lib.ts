export type SectionStatus = "PASS" | "WARN" | "FAIL";

export type SafeRunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  exitCode?: number;
};

type AuditCounts = {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
};

type AuditJson = {
  metadata?: {
    vulnerabilities?: Partial<AuditCounts>;
  };
};

export function normalizeExecOutput(
  output: Buffer | string | null | undefined,
) {
  if (typeof output === "string") return output;
  if (Buffer.isBuffer(output)) return output.toString("utf8");
  return "";
}

function readAuditVulnerabilities(jsonText: string) {
  const parsed = JSON.parse(jsonText) as AuditJson;
  return parsed.metadata?.vulnerabilities ?? {};
}

function finiteNumber(value: unknown, fallback: number) {
  const candidate = Number(value ?? fallback);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function parseSeverityCounts(vulnerabilities: Partial<AuditCounts>) {
  return {
    critical: finiteNumber(vulnerabilities.critical, 0),
    high: finiteNumber(vulnerabilities.high, 0),
    moderate: finiteNumber(vulnerabilities.moderate, 0),
    low: finiteNumber(vulnerabilities.low, 0),
  };
}

export function parseAuditCounts(jsonText: string): AuditCounts {
  const vulnerabilities = readAuditVulnerabilities(jsonText);
  const { critical, high, moderate, low } =
    parseSeverityCounts(vulnerabilities);
  const fallbackTotal = critical + high + moderate + low;
  const reportedTotal = finiteNumber(vulnerabilities.total, fallbackTotal);

  return {
    total: reportedTotal,
    critical,
    high,
    moderate,
    low,
  };
}

function buildMissingAuditJsonSection(audit: SafeRunResult) {
  return {
    status: "WARN" as const,
    lines: [
      "- npm audit did not produce JSON output.",
      ...(audit.error ? [`- Error: ${audit.error}`] : []),
      ...(audit.stderr.trim() ? [`- stderr: ${audit.stderr.trim()}`] : []),
      "- Action: run `npm audit --json` locally to inspect the raw output.",
    ],
  };
}

function buildUnparseableAuditJsonSection(
  audit: SafeRunResult,
  parseError: string,
) {
  return {
    status: "WARN" as const,
    lines: [
      "- npm audit produced non-parseable JSON output.",
      ...(audit.error ? [`- Error: ${audit.error}`] : []),
      `- Parse error: ${parseError}`,
      "- Action: run `npm audit --json` locally to inspect the raw output.",
    ],
  };
}

function classifyAuditStatus(
  counts: AuditCounts,
  auditOk: boolean,
): SectionStatus {
  if (counts.critical > 0 || counts.high > 0) return "FAIL";
  if (counts.total > 0 || !auditOk) return "WARN";
  return "PASS";
}

function buildAuditExitLines(audit: SafeRunResult) {
  if (audit.ok) return [];

  return [
    "- npm audit exited non-zero but produced JSON output, so the readiness gate evaluated that JSON payload.",
    ...(audit.error ? [`- Exit detail: ${audit.error}`] : []),
    "",
  ];
}

function buildAuditCountLines(counts: AuditCounts) {
  return [
    "- Vulnerability counts:",
    `  - critical: ${counts.critical}`,
    `  - high: ${counts.high}`,
    `  - moderate: ${counts.moderate}`,
    `  - low: ${counts.low}`,
    `  - total: ${counts.total}`,
  ];
}

function buildAuditFollowUpLines(counts: AuditCounts) {
  if (counts.critical > 0 || counts.high > 0) {
    return [
      "",
      "- Follow-up:",
      "  - Remediate critical or high vulnerabilities or gate releases until resolved.",
    ];
  }

  return [
    "",
    "- Follow-up:",
    "  - Review moderate or low findings and plan upgrades where feasible.",
  ];
}

export function buildAuditSection(audit: SafeRunResult): {
  status: SectionStatus;
  lines: string[];
} {
  const jsonText = audit.stdout.trim();

  if (!jsonText) {
    return buildMissingAuditJsonSection(audit);
  }

  let counts: AuditCounts;
  try {
    counts = parseAuditCounts(jsonText);
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to parse npm audit JSON.";
    return buildUnparseableAuditJsonSection(audit, msg);
  }

  const status = classifyAuditStatus(counts, audit.ok);
  const lines = [
    ...buildAuditExitLines(audit),
    ...buildAuditCountLines(counts),
  ];

  if (status !== "PASS") {
    lines.push(...buildAuditFollowUpLines(counts));
  }

  return { status, lines };
}
