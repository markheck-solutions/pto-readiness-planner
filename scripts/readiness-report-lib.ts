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

export function normalizeExecOutput(
  output: Buffer | string | null | undefined,
) {
  if (typeof output === "string") return output;
  if (Buffer.isBuffer(output)) return output.toString("utf8");
  return "";
}

export function parseAuditCounts(jsonText: string): AuditCounts {
  type AuditJson = {
    metadata?: {
      vulnerabilities?: Partial<AuditCounts>;
    };
  };

  const parsed = JSON.parse(jsonText) as AuditJson;
  const vulnerabilities = parsed.metadata?.vulnerabilities;

  const critical = Number(vulnerabilities?.critical ?? 0);
  const high = Number(vulnerabilities?.high ?? 0);
  const moderate = Number(vulnerabilities?.moderate ?? 0);
  const low = Number(vulnerabilities?.low ?? 0);
  const fallbackTotal = critical + high + moderate + low;
  const reportedTotal = Number(vulnerabilities?.total ?? fallbackTotal);

  return {
    total: Number.isFinite(reportedTotal) ? reportedTotal : fallbackTotal,
    critical,
    high,
    moderate,
    low,
  };
}

export function buildAuditSection(audit: SafeRunResult): {
  status: SectionStatus;
  lines: string[];
} {
  const jsonText = audit.stdout.trim();

  if (!jsonText) {
    return {
      status: "WARN",
      lines: [
        "- npm audit did not produce JSON output.",
        ...(audit.error ? [`- Error: ${audit.error}`] : []),
        ...(audit.stderr.trim() ? [`- stderr: ${audit.stderr.trim()}`] : []),
        "- Action: run `npm audit --json` locally to inspect the raw output.",
      ],
    };
  }

  let counts: AuditCounts;
  try {
    counts = parseAuditCounts(jsonText);
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to parse npm audit JSON.";
    return {
      status: "WARN",
      lines: [
        "- npm audit produced non-parseable JSON output.",
        ...(audit.error ? [`- Error: ${audit.error}`] : []),
        `- Parse error: ${msg}`,
        "- Action: run `npm audit --json` locally to inspect the raw output.",
      ],
    };
  }

  const status: SectionStatus =
    counts.critical > 0 || counts.high > 0
      ? "FAIL"
      : counts.total > 0 || !audit.ok
        ? "WARN"
        : "PASS";

  const lines = [
    ...(!audit.ok
      ? [
          "- npm audit exited non-zero but produced JSON output, so the readiness gate evaluated that JSON payload.",
          ...(audit.error ? [`- Exit detail: ${audit.error}`] : []),
          "",
        ]
      : []),
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

  return { status, lines };
}
