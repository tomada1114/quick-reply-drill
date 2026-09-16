import * as z from "zod";

import {
  questionsRequestSchema,
  questionsResponseSchema,
  scoreResponseSchema,
  type QuestionsResponse,
  type ScoreRequest,
  type ScoreResponse,
} from "@/core/wire";

/**
 * The failure envelope every non-2xx answer from this application's own
 * endpoints carries, built by `failure()` in `src/server/http.ts`.
 *
 * @remarks
 * Restated here rather than imported: `src/server/**` sits outside what
 * `src/components/**` may reach (the import order is `app` → `components` →
 * `core`), so this is the one seam that has to agree with that shape
 * independently of the module graph — the wire itself.
 */
const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

/** The code {@link ApiError} carries when a non-2xx body is not the envelope. */
const UNKNOWN_RESPONSE_CODE = "ERR_UNKNOWN_RESPONSE";

/**
 * A non-2xx answer from `/api/questions` or `/api/score`.
 *
 * @remarks
 * `code` stays `string` rather than a literal union: the vocabulary it is
 * drawn from — `ERR_BAD_REQUEST`, `ERR_FORBIDDEN_ORIGIN`, the `ERR_LLM_*`
 * codes, and so on — is declared under `src/server/**` and `src/ai/**`, which
 * this zone may not import, so nothing here can see the closed set to narrow
 * against. A caller branches on the string value it actually received.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Builds the {@link ApiError} a non-2xx `response` reports.
 *
 * @remarks
 * A response that is not JSON, or is JSON that does not match the envelope
 * `failure()` writes, still becomes an `ApiError` rather than throwing a
 * second, different exception out of this function — every non-2xx answer a
 * caller sees is the same shape, whether or not the server that produced it
 * was this application's own.
 */
async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return new ApiError(
      response.status,
      UNKNOWN_RESPONSE_CODE,
      "The server returned an error response that was not valid JSON.",
    );
  }

  const parsed = errorEnvelopeSchema.safeParse(payload);
  if (!parsed.success) {
    return new ApiError(
      response.status,
      UNKNOWN_RESPONSE_CODE,
      "The server returned an error response that did not match the expected shape.",
    );
  }

  return new ApiError(
    response.status,
    parsed.data.error.code,
    parsed.data.error.message,
  );
}

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
    throw await toApiError(response);
  }

  const json: unknown = await response.json();
  return schema.parse(json);
}

/**
 * Fetches `count` freshly generated questions from `POST /api/questions`.
 *
 * @remarks
 * `count` is validated against {@link questionsRequestSchema} — which caps it
 * at `MAX_QUESTIONS_PER_BATCH` — before anything is sent, so a caller asking
 * for too many fails locally instead of spending a round trip on a request
 * the server would refuse anyway.
 */
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
  return postJson("/api/score", body, scoreResponseSchema, signal);
}
