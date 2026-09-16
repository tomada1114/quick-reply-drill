import type { LlmPort } from "../../ai/index";
import {
  drawSeeds as drawSeedsFromTables,
  type ScenarioSeed,
} from "../../core/scenarios";
import {
  MAX_QUESTIONS_PER_BATCH,
  questionsRequestSchema,
  type QuestionsResponse,
} from "../../core/wire";
import { failure, llmFailure, rejectCrossOrigin } from "../http";
import { buildQuestionsRequest } from "../prompts/questions";
import { readJsonBody } from "../request-body";

/**
 * What the handler needs from the outside world.
 *
 * @remarks
 * The port is what `src/server/composition.ts` decides; the other two are
 * non-determinism — a draw and an id — taken as arguments so a test can make
 * an answer reproducible without reaching for a module mock. Both default to
 * the real thing, so the composition root names neither.
 */
export interface QuestionsHandlerDependencies {
  /** The model this endpoint asks for its questions. */
  readonly llm: LlmPort;

  /** Draws the scenarios the questions are generated for. */
  readonly drawSeeds?: (count: number) => readonly ScenarioSeed[];

  /** Mints the id each question is keyed by for the rest of its life. */
  readonly randomUUID?: () => string;
}

/**
 * Builds the `POST /api/questions` handler over the port it is given.
 *
 * @remarks
 * Web standards only: a `Request` in, a `Response` out, and no import from
 * `next`, so a test drives it with a plain `new Request(...)` and the Route
 * Handler under `src/app/` stays a re-export with no logic of its own.
 *
 * The order of the steps is the point. The origin guard runs before the body
 * is read, and the body is validated before anything is drawn or generated, so
 * nothing a caller can send reaches the port — the one step that costs money —
 * until it is known to be a legal request from this application's own pages.
 *
 * @returns The handler `src/app/api/questions/route.ts` exports as `POST`.
 */
export function createQuestionsHandler(
  dependencies: QuestionsHandlerDependencies,
): (request: Request) => Promise<Response> {
  const {
    llm,
    drawSeeds = drawSeedsFromTables,
    randomUUID = (): string => crypto.randomUUID(),
  } = dependencies;

  return async function handleQuestions(request: Request): Promise<Response> {
    const originFailure = rejectCrossOrigin(request);
    if (originFailure !== undefined) {
      return originFailure;
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      return body.error;
    }

    const parsed = questionsRequestSchema.safeParse(body.value);
    if (!parsed.success) {
      return failure(
        400,
        "ERR_BAD_REQUEST",
        `The request body must be an object with a \`count\` integer of 1 to ${String(MAX_QUESTIONS_PER_BATCH)}.`,
      );
    }

    const seeds = drawSeeds(parsed.data.count);
    const result = await llm.generate({
      ...buildQuestionsRequest(seeds),
      // A client that hangs up aborts this signal, which the port forwards to
      // the provider instead of paying for an answer nobody will read.
      signal: request.signal,
    });

    if (!result.ok) {
      return llmFailure(result.error);
    }

    return Response.json(toAnswer(seeds, result.value.questions, randomUUID), {
      status: 200,
    });
  };
}

/** One question as the model wrote it, before the server's own fields. */
interface GeneratedQuestion {
  readonly question: string;
  readonly scenarioLine: string;
}

/**
 * Pairs each drawn seed with the question generated for it.
 *
 * @remarks
 * By position, which is what the prompt asks the model for and what the
 * schema's count refinement makes safe: a batch that came back short or long
 * is already an `ERR_LLM_INVALID_OUTPUT` from the port, so the two lists are
 * the same length by the time this runs. The `undefined` branch satisfies
 * `noUncheckedIndexedAccess` rather than guarding a reachable case.
 */
function toAnswer(
  seeds: readonly ScenarioSeed[],
  generated: readonly GeneratedQuestion[],
  randomUUID: () => string,
): QuestionsResponse {
  return {
    questions: seeds.flatMap((seed, index) => {
      const written = generated[index];
      if (written === undefined) {
        return [];
      }
      return [
        {
          id: randomUUID(),
          question: written.question,
          scenarioLine: written.scenarioLine,
          seed: {
            interlocutorId: seed.interlocutor.id,
            settingId: seed.setting.id,
            topicId: seed.topic.id,
          },
        },
      ];
    }),
  };
}
