import { NextResponse } from "next/server";

import {
  DEMO_DATASET_VERSION,
  DEMO_DATE_BOUNDS,
  DEMO_FICTIONAL_NOTICE,
  DEMO_SEED_FINGERPRINT,
  demoRoles,
  demoTeams,
} from "../../../src/demo/dataset";

function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return fallback;
}

export async function GET() {
  const demoMode = parseBooleanEnv(process.env.NEXT_PUBLIC_DEMO_MODE, true);

  const teams = demoTeams.map((t) => ({ id: t.id, name: t.name }));
  const roles = demoRoles.map((r) => ({ id: r.id, name: r.name }));

  return NextResponse.json(
    {
      demoMode,
      datasetVersion: DEMO_DATASET_VERSION,
      seedFingerprint: DEMO_SEED_FINGERPRINT,
      notice: DEMO_FICTIONAL_NOTICE,
      dateBounds: DEMO_DATE_BOUNDS,
      teams,
      roles,
      filters: {
        teams,
        roles,
        coverageBands: ["healthy", "thin", "risky", "critical"],
        recommendations: [
          "approve",
          "approve_with_coverage_actions",
          "needs_discussion",
          "defer",
        ],
        dateRangePresets: ["next-8-weeks", "next-12-weeks"],
      },
    },
    { status: 200 },
  );
}
