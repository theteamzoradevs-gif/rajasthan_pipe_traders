import { NextResponse } from "next/server";

/** Log token for Vercel: grep `ERROR_2366327071` in function logs. */
const API_ERROR_LOG = "ERROR_2366327071";

export function logApiRouteError(route: string, e: unknown, context?: Record<string, unknown>) {
  const err = e instanceof Error ? e : new Error(String(e));
  const payload = {
    message: err.message,
    stack: err instanceof Error ? err.stack : undefined,
    name: err instanceof Error ? err.name : undefined,
    ...context,
  };
  console.error(API_ERROR_LOG, { route, ...payload });
}

/** JSON body for unexpected handler failures (matches client expectations via `details` + `message`). */
export function serverFetchError(
  e: unknown,
  status = 500,
  logContext?: { route?: string; extra?: Record<string, unknown> }
) {
  const route = logContext?.route ?? "api";
  logApiRouteError(route, e, logContext?.extra);
  const details = e instanceof Error ? e.message : String(e);
  return NextResponse.json(
    { error: "Failed to fetch data", details, message: details },
    { status }
  );
}
