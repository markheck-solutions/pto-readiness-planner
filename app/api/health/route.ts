import { NextResponse } from "next/server";

import { methodNotAllowed } from "../../../src/api/safeError";
import { resolveManagerDraftProvider } from "../../../src/domain/managerDraft/providerMode";

export async function GET() {
  const draftProvider = resolveManagerDraftProvider(process.env);
  const demoMode = draftProvider.demoMode;

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
        privateLocalAi: draftProvider.source === "local",
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
