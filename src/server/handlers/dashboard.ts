import type { LlmPort } from "../../ai/index";
import {
  dashboardRequestSchema,
  MAX_DASHBOARD_RECORDS,
  type DashboardResponse,
} from "../../core/wire";
import { failure, llmFailure, rejectCrossOrigin } from "../http";
import { buildDashboardRequest } from "../prompts/dashboard";
import { readJsonBody } from "../request-body";

/** What the handler needs from the outside world. */
export interface DashboardHandlerDependencies {
  /** The model this endpoint asks for the trend paragraph. */
  readonly llm: LlmPort;
}

/**
 * What a rejected body is told, naming every constraint and no content.
 *
 * @remarks
 * Covers both refusals `dashboardRequestSchema` can produce: an array outside
 * `1..MAX_DASHBOARD_RECORDS`, and one that mixes `rubricVersion` across its
 * records — the client is expected to have filtered to one version already.
 */
const REJECTED_BODY_MESSAGE = [
  "The request body must be an object with a `records` array of 1 to",
  `${String(MAX_DASHBOARD_RECORDS)} entries, all sharing the same \`rubricVersion\`.`,
].join(" ");

/**
 * Builds the `POST /api/dashboard` handler over the port it is given.
 *
 * @remarks
 * Web standards only: a `Request` in, a `Response` out, and no import from
 * `next`, so a test drives it with a plain `new Request(...)` and the Route
 * Handler under `src/app/` stays a re-export with no logic of its own.
 *
 * The order of the steps is the point. The origin guard runs before the body
 * is read, and the body is validated before anything is summarised, so
 * nothing a caller can send reaches the port — the one step that costs
 * money — until it is known to be a legal request from this application's own
 * pages.
 *
 * @returns The handler `src/app/api/dashboard/route.ts` exports as `POST`.
 */
export function createDashboardHandler(
  dependencies: DashboardHandlerDependencies,
): (request: Request) => Promise<Response> {
  const { llm } = dependencies;

  return async function handleDashboard(request: Request): Promise<Response> {
    const originFailure = rejectCrossOrigin(request);
    if (originFailure !== undefined) {
      return originFailure;
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.error;
    }

    const parsed = dashboardRequestSchema.safeParse(body.value);
    if (!parsed.success) {
      return failure(400, "ERR_BAD_REQUEST", REJECTED_BODY_MESSAGE);
    }

    const result = await llm.generate({
      ...buildDashboardRequest(parsed.data.records),
      // A client that hangs up aborts this signal, which the port forwards to
      // the provider instead of paying for an answer nobody will read.
      signal: request.signal,
    });

    if (!result.ok) {
      return llmFailure(result.error);
    }

    const answer: DashboardResponse = { summary: result.value.summary };
    return Response.json(answer, { status: 200 });
  };
}
