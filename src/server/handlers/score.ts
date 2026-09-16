import type { LlmPort } from "../../ai/index";
import {
  MAX_SCORE_ANSWER_LENGTH,
  MAX_SCORE_QUESTION_LENGTH,
  MAX_SCORE_SCENARIO_LINE_LENGTH,
  scoreRequestSchema,
  type ScoreResponse,
} from "../../core/wire";
import { failure, llmFailure, rejectCrossOrigin } from "../http";
import type { LlmProfile } from "../llm-profiles";
import {
  buildScoringRequest,
  RUBRIC_VERSION,
  truncateGraderProse,
} from "../prompts/scoring";
import { readJsonBody } from "../request-body";

/**
 * What the handler needs from the outside world.
 *
 * @remarks
 * The port and the profile it was built from arrive together and from the same
 * place — `src/server/composition.ts` — because an answer that named a model
 * the call was not actually made with would be worse than naming none: a
 * stored score is only comparable to another when both record what graded
 * them.
 */
export interface ScoreHandlerDependencies {
  /** The model this endpoint asks for its grading. */
  readonly llm: LlmPort;

  /** The profile `llm` was built from, echoed in the answer. */
  readonly model: LlmProfile;
}

/**
 * What a rejected body is told, naming every constraint and no content.
 *
 * @remarks
 * Assembled from the same constants the schema is built with, so a ceiling
 * moved in `src/core/wire.ts` cannot leave this sentence stating the old one.
 */
const REJECTED_BODY_MESSAGE = [
  "The request body must be an object with a `question` of 1 to",
  `${String(MAX_SCORE_QUESTION_LENGTH)} characters, a \`scenarioLine\` of at most`,
  `${String(MAX_SCORE_SCENARIO_LINE_LENGTH)} characters, and an \`answer\` of 1 to`,
  `${String(MAX_SCORE_ANSWER_LENGTH)} characters, each once trimmed.`,
].join(" ");

/**
 * Builds the `POST /api/score` handler over the port it is given.
 *
 * @remarks
 * Web standards only: a `Request` in, a `Response` out, and no import from
 * `next`, so a test drives it with a plain `new Request(...)` and the Route
 * Handler under `src/app/` stays a re-export with no logic of its own.
 *
 * The order of the steps is the point. The origin guard runs before the body
 * is read, and the body is validated before anything is graded, so nothing a
 * caller can send reaches the port — the one step that costs money — until it
 * is known to be a legal request from this application's own pages.
 *
 * @returns The handler `src/app/api/score/route.ts` exports as `POST`.
 */
export function createScoreHandler(
  dependencies: ScoreHandlerDependencies,
): (request: Request) => Promise<Response> {
  const { llm, model } = dependencies;

  return async function handleScore(request: Request): Promise<Response> {
    const originFailure = rejectCrossOrigin(request);
    if (originFailure !== undefined) {
      return originFailure;
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.error;
    }

    const parsed = scoreRequestSchema.safeParse(body.value);
    if (!parsed.success) {
      return failure(400, "ERR_BAD_REQUEST", REJECTED_BODY_MESSAGE);
    }

    const result = await llm.generate({
      ...buildScoringRequest(parsed.data),
      // A client that hangs up aborts this signal, which the port forwards to
      // the provider instead of paying for an answer nobody will read.
      signal: request.signal,
    });

    if (!result.ok) {
      return llmFailure(result.error);
    }

    const answer: ScoreResponse = {
      rubricVersion: RUBRIC_VERSION,
      // The profile names the model as the provider knows it; the wire calls
      // that an alias, because it is what a stored record identifies a grader
      // by rather than something a client may ask for.
      model: { alias: model.model, reasoningEffort: model.reasoningEffort },
      // Bounds the grader's own prose to what a stored record must stay
      // within, so a model that ignores the budget `GRADING_RULES` states
      // still answers with a `DrillRecord` `POST /api/dashboard` will accept.
      ...truncateGraderProse(result.value),
    };
    return Response.json(answer, { status: 200 });
  };
}
