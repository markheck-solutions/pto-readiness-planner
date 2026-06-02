import { NextResponse } from "next/server";

import { jsonError, methodNotAllowed } from "../../../src/api/safeError";
import { generateManagerDraft } from "../../../src/domain/managerDraft/service";
import {
  managerDraftActionValues,
  type ManagerDraftAction,
} from "../../../src/domain/managerDraft/types";

export const runtime = "nodejs";

function isDraftAction(value: unknown): value is ManagerDraftAction {
  return (
    typeof value === "string" &&
    (managerDraftActionValues as readonly string[]).includes(value)
  );
}

function hasOnlyAllowedKeys(body: Record<string, unknown>): boolean {
  const allowed = new Set(["requestId", "action"]);
  return Object.keys(body).every((key) => allowed.has(key));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "bad_json", "Request body must be valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError(400, "invalid_request", "Request body must be an object.");
  }

  const payload = body as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(payload)) {
    return jsonError(
      400,
      "invalid_request",
      "Only requestId and action are accepted.",
      {
        allowedFields: ["requestId", "action"],
      },
    );
  }

  const requestId =
    typeof payload.requestId === "string" ? payload.requestId.trim() : "";
  if (!requestId) {
    return jsonError(400, "invalid_request", "requestId is required.");
  }

  if (!isDraftAction(payload.action)) {
    return jsonError(400, "invalid_request", "Invalid action.", {
      allowed: [...managerDraftActionValues],
    });
  }

  const result = await generateManagerDraft({
    requestId,
    action: payload.action,
  });

  if (!result) {
    return jsonError(404, "not_found", "Request not found.", { requestId });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function GET() {
  return methodNotAllowed(["POST"]);
}
export async function PUT() {
  return methodNotAllowed(["POST"]);
}
export async function PATCH() {
  return methodNotAllowed(["POST"]);
}
export async function DELETE() {
  return methodNotAllowed(["POST"]);
}
