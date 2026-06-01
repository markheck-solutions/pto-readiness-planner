import { NextResponse } from "next/server";

import {
  DEMO_DATASET_VERSION,
  DEMO_FICTIONAL_NOTICE,
  DEMO_SEED_FINGERPRINT,
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

  return NextResponse.json(
    {
      demoMode,
      datasetVersion: DEMO_DATASET_VERSION,
      seedFingerprint: DEMO_SEED_FINGERPRINT,
      notice: DEMO_FICTIONAL_NOTICE,
    },
    { status: 200 },
  );
}
