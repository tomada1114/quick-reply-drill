import * as z from "zod";

/** The failure envelope every application endpoint returns for non-2xx answers. */
const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

/** The code used when a response does not match the application's error shape. */
const UNKNOWN_RESPONSE_CODE = "ERR_UNKNOWN_RESPONSE";

/** A non-2xx answer from one of this application's JSON endpoints. */
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

/** Converts an endpoint response into the stable error shape the client uses. */
export async function parseApiErrorResponse(response: Response): Promise<ApiError> {
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

/** Builds an error for a successful response that could not be read as JSON. */
export function createUnknownResponseError(status: number, message: string): ApiError {
  return new ApiError(status, UNKNOWN_RESPONSE_CODE, message);
}
