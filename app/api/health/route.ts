import { NextResponse } from "next/server";

import { methodNotAllowed } from "../../../src/api/safeError";

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
  const aiProvider = process.env.AI_PROVIDER ?? "mock";

  // Safe build metadata. Do not include env values like DATABASE_URL or API keys.
  const build = {
    vercelEnv: process.env.VERCEL_ENV ?? null,
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    buildId: process.env.VERCEL_BUILD_ID ?? null,
  };

  return NextResponse.json(
    {
      service: "pto-readiness-planner",
      status: "ok",
      demoMode,
      capabilities: {
        publicDemo: demoMode,
        mockAi: true,
        privateLocalAi: !demoMode && aiProvider === "local",
      },
      build,
    },
    { status: 200 },
  );
}

export async function POST() {
  return methodNotAllowed(["GET"]);
}
export async function PUT() {
  return methodNotAllowed(["GET"]);
}
export async function PATCH() {
  return methodNotAllowed(["GET"]);
}
export async function DELETE() {
  return methodNotAllowed(["GET"]);
}
