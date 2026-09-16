import "server-only";

import { createFakeLlmPort, createOpenAiLlmPort, type LlmPort } from "../ai/index";
import { readServerEnv } from "./env";
import { createAskHandler } from "./handlers/ask";
import { createQuestionsHandler } from "./handlers/questions";
import { LLM_PROFILES, type LlmUse } from "./llm-profiles";

// Read once, at module load, so a malformed environment stops the server as it
// starts rather than showing up as a puzzling failure on some later request.
const env = readServerEnv();

/**
 * The one line in this repository that decides which vendor answers.
 *
 * @remarks
 * A provider adapter is chosen here and nowhere else — no environment variable
 * selects between them at runtime, because that would move the choice out of
 * the file whose whole job is to hold it. What varies per use is only the
 * profile: `src/server/llm-profiles.ts` holds the model and the reasoning
 * effort, and those two files are the only ones that name a model at all.
 *
 * `fetch` is passed explicitly as `undefined` so the adapter falls back to the
 * runtime's own. It is spelled out rather than left off because this is the
 * one place a transport could legitimately be substituted, and a reader should
 * see that it has not been.
 */
function openAiPortFor(use: LlmUse): LlmPort {
  return createOpenAiLlmPort({
    apiKey: env.OPENAI_API_KEY,
    ...LLM_PROFILES[use],
    fetch: undefined,
  });
}

/**
 * One port per use, built up front.
 *
 * @remarks
 * A missing key is not a start-up failure: the adapter answers `ERR_LLM_AUTH`
 * on the request that needed it, so `pnpm dev` and the smoke suite both run
 * with nothing configured and fail where a caller can see it.
 */
const ports: Record<LlmUse, LlmPort> = {
  questions: openAiPortFor("questions"),
  scoring: openAiPortFor("scoring"),
  dashboard: openAiPortFor("dashboard"),
};

/**
 * The fake port `POST /api/ask` still answers from.
 *
 * @remarks
 * `/api/ask` is the template's demonstration endpoint and is deleted with the
 * scoring endpoint that replaces it. Leaving it on the fake until then keeps
 * it answering with no credential configured, which is what it exists to show.
 */
const fakeLlm = createFakeLlmPort({
  response: {
    answer:
      "This answer comes from the fake LLM adapter, so the endpoint works with no API key. Swap the adapter in src/server/composition.ts to reach a real model.",
  },
});

/** The handler `src/app/api/ask/route.ts` publishes as its `POST` export. */
export const askHandler = createAskHandler({ llm: fakeLlm });

/** The handler `src/app/api/questions/route.ts` publishes as its `POST` export. */
export const questionsHandler = createQuestionsHandler({ llm: ports.questions });
