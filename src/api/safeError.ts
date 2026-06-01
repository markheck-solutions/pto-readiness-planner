import { NextResponse } from "next/server";

export type SafeErrorCode =
  | "method_not_allowed"
  | "invalid_request"
  | "not_found"
  | "bad_json"
  | "internal_error";

export type SafeErrorBody = {
  error: {
    code: SafeErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function jsonError(
  status: number,
  code: SafeErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  const body: SafeErrorBody = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  return NextResponse.json(body, { status });
}

export function methodNotAllowed(allowed: string[]) {
  return jsonError(405, "method_not_allowed", "Method not allowed.", {
    allowed,
  });
}
