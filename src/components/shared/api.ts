import type * as z from "zod";

import {
  dashboardRequestSchema,
  dashboardResponseSchema,
  questionsRequestSchema,
  questionsResponseSchema,
  scoreRequestSchema,
  scoreResponseSchema,
  type DashboardRecord,
  type DashboardResponse,
  type QuestionsResponse,
  type ScoreRequest,
  type ScoreResponse,
} from "@/core/wire";

import { createUnknownResponseError, parseApiErrorResponse } from "./api-error";

export { ApiError } from "./api-error";

/**
 * Posts `body` as JSON to `path` and parses a 2xx answer with `schema`.
 *
 * @remarks
 * `credentials: "same-origin"` is explicit rather than relied on as a
 * default: the browser adds `Sec-Fetch-Site` itself, and this is the one
 * fetch option every call this module makes shares.
 */
async function postJson<TSchema extends z.ZodType>(
  path: string,
  body: unknown,
  schema: TSchema,
  signal: AbortSignal | undefined,
): Promise<z.infer<TSchema>> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // `RequestInit.signal` is `AbortSignal | null | undefined`; `null` is
    // what `exactOptionalPropertyTypes` requires for "no signal given" rather
    // than `undefined`.
    signal: signal ?? null,
  });

  if (!response.ok) {
    throw await parseApiErrorResponse(response);
  }

  // A 2xx answer is expected to be JSON, but a proxy, an offline
  // service-worker fallback, or a rewrite answering 200 with HTML is not.
  // Route that failure through the same `ApiError` shape as a non-2xx
  // answer, rather than letting a raw `SyntaxError` escape this module.
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw createUnknownResponseError(
      response.status,
      "The server returned a success response that was not valid JSON.",
    );
  }
  return schema.parse(json);
}

/** Fetches `count` freshly generated questions from `POST /api/questions`. */
export async function fetchQuestions(
  count: number,
  signal?: AbortSignal,
): Promise<QuestionsResponse> {
  const body = questionsRequestSchema.parse({ count });
  return postJson("/api/questions", body, questionsResponseSchema, signal);
}

/** Submits a reply to `POST /api/score` and parses the graded answer back. */
export async function submitForScoring(
  body: ScoreRequest,
  signal?: AbortSignal,
): Promise<ScoreResponse> {
  const parsedBody = scoreRequestSchema.parse(body);
  return postJson("/api/score", parsedBody, scoreResponseSchema, signal);
}

/** Posts `records` to `POST /api/dashboard` and parses the trend paragraph back. */
export async function fetchDashboardSummary(
  records: DashboardRecord[],
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  const parsedBody = dashboardRequestSchema.parse({ records });
  return postJson("/api/dashboard", parsedBody, dashboardResponseSchema, signal);
}
