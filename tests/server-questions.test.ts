import { describe, expect, it } from "vitest";
import type * as z from "zod";

import {
  createFakeLlmPort,
  type LlmError,
  type LlmPort,
  type LlmRequest,
} from "../src/ai/index";
import { POST } from "../src/app/api/questions/route";
import type { Result } from "../src/core/result";
import type { ScenarioSeed } from "../src/core/scenarios";
import { questionsResponseSchema } from "../src/core/wire";
import { questionsHandler } from "../src/server/composition";
import { createQuestionsHandler } from "../src/server/handlers/questions";

/** The origin a `Request` needs to be constructible; nothing reads the path. */
const ENDPOINT = "http://localhost/api/questions";

/** Three seeds, drawn by hand so the order this suite asserts on is fixed. */
const SEEDS: readonly ScenarioSeed[] = [
  {
    interlocutor: { id: "coworker", label: "a coworker", relationship: "familiar" },
    setting: { id: "workChat", label: "a work chat", register: "neutral" },
    topic: { id: "scheduling", label: "a schedule change" },
  },
  {
    interlocutor: { id: "closeFriend", label: "a close friend", relationship: "close" },
    setting: { id: "groupChat", label: "a group chat", register: "casual" },
    topic: { id: "weekendPlans", label: "weekend plans" },
  },
  {
    interlocutor: { id: "client", label: "a client", relationship: "distant" },
    setting: { id: "email", label: "an email thread", register: "formal" },
    topic: { id: "deadline", label: "a deadline slipping" },
  },
];

/** What the model is configured to answer, one entry per seed above. */
const GENERATED = {
  questions: [
    {
      question: "Can we move tomorrow's stand-up?",
      scenarioLine: "A coworker, at work",
    },
    {
      question: "Still on for Saturday?",
      scenarioLine: "A close friend, in a group chat",
    },
    {
      question: "Could you confirm the new delivery date?",
      scenarioLine: "A client, in an email thread",
    },
  ],
};

/** What the port was asked, as the handler passed it on. */
interface CapturedRequest {
  readonly instructions: string | undefined;
  readonly prompt: string;
  readonly signal: AbortSignal | undefined;
}

/**
 * Wraps a port so a test can assert on what the handler asked it.
 *
 * @remarks
 * A recording wrapper rather than a mock: the request still reaches a real
 * fake port and comes back through the same code path, so the assertions are
 * about behavior rather than about how many times something was called.
 */
function capturing(inner: LlmPort, seen: CapturedRequest[]): LlmPort {
  return {
    generate<TSchema extends z.ZodType>(
      request: LlmRequest<TSchema>,
    ): Promise<Result<z.infer<TSchema>, LlmError>> {
      seen.push({
        instructions: request.instructions,
        prompt: request.prompt,
        signal: request.signal,
      });
      return inner.generate(request);
    },
  };
}

/** A port that fails the test if anything reaches it. */
function unreachablePort(): LlmPort {
  return {
    generate(): never {
      throw new Error(
        "the port was asked for an answer the handler should have refused",
      );
    },
  };
}

/** A handler over the fixed seeds, the fixed answer, and predictable ids. */
function handlerOver(llm: LlmPort): (request: Request) => Promise<Response> {
  let issued = 0;
  return createQuestionsHandler({
    llm,
    drawSeeds: (count) => SEEDS.slice(0, count),
    randomUUID: () => {
      issued += 1;
      return `id-${String(issued)}`;
    },
  });
}

/** A `POST` carrying `body` verbatim, with the origin header unless removed. */
function postRequest(body: string, init: RequestInit = {}): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
    },
    body,
    ...init,
  });
}

describe("POST /api/questions", () => {
  it("is what the Route Handler publishes, so the composed handler is the one served", () => {
    expect(POST).toBe(questionsHandler);
  });

  it("refuses a request that does not identify itself as same-origin", async () => {
    const response = await handlerOver(unreachablePort())(
      new Request(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: 3 }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_FORBIDDEN_ORIGIN" },
    });
  });

  it.each([
    ["a count below the floor", { count: 0 }],
    ["a count above the ceiling", { count: 99 }],
    ["no count at all", {}],
  ])("refuses %s without reaching the port", async (_case, body) => {
    const response = await handlerOver(unreachablePort())(
      postRequest(JSON.stringify(body)),
    );

    expect(response.status).toBe(400);
    const answer: unknown = await response.json();
    expect(answer).toMatchObject({ error: { code: "ERR_BAD_REQUEST" } });
    // The message names the constraint and never the body it refused.
    expect(JSON.stringify(answer)).toContain("`count`");
    expect(JSON.stringify(answer)).not.toContain("99");
  });

  it("answers one question per drawn seed, in order, with an id and the seed's ids", async () => {
    const response = await handlerOver(createFakeLlmPort({ response: GENERATED }))(
      postRequest(JSON.stringify({ count: 3 })),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const answer = questionsResponseSchema.parse(await response.json());

    expect(answer.questions.map((one) => one.id)).toStrictEqual([
      "id-1",
      "id-2",
      "id-3",
    ]);
    expect(answer.questions.map((one) => one.question)).toStrictEqual(
      GENERATED.questions.map((one) => one.question),
    );
    expect(answer.questions.map((one) => one.scenarioLine)).toStrictEqual(
      GENERATED.questions.map((one) => one.scenarioLine),
    );
    expect(answer.questions.map((one) => one.seed)).toStrictEqual(
      SEEDS.map((seed) => ({
        interlocutorId: seed.interlocutor.id,
        settingId: seed.setting.id,
        topicId: seed.topic.id,
      })),
    );
  });

  it("asks for as many questions as the caller asked for", async () => {
    const response = await handlerOver(
      createFakeLlmPort({ response: { questions: GENERATED.questions.slice(0, 2) } }),
    )(postRequest(JSON.stringify({ count: 2 })));

    expect(response.status).toBe(200);
    const answer = questionsResponseSchema.parse(await response.json());
    expect(answer.questions).toHaveLength(2);
  });

  it("hands the port the prompt's instruction block", async () => {
    const seen: CapturedRequest[] = [];
    await handlerOver(capturing(createFakeLlmPort({ response: GENERATED }), seen))(
      postRequest(JSON.stringify({ count: 3 })),
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]?.instructions).toContain("practice prompts");
    // The seeds reach the model as the per-request turn, never as instructions.
    expect(seen[0]?.prompt).toContain("a coworker");
    expect(seen[0]?.instructions).not.toContain("a coworker");
  });

  it("forwards the caller's cancellation to the port", async () => {
    const seen: CapturedRequest[] = [];
    const controller = new AbortController();

    const request = postRequest(JSON.stringify({ count: 3 }), {
      signal: controller.signal,
    });
    await handlerOver(capturing(createFakeLlmPort({ response: GENERATED }), seen))(
      request,
    );
    const forwarded = seen[0]?.signal;
    expect(forwarded?.aborted).toBe(false);

    controller.abort();

    expect(forwarded?.aborted).toBe(true);
  });

  // The batch that came back the wrong size is the same failure as the batch
  // that came back malformed: the port validates the count refinement, so the
  // handler never sees questions it could not pair with a seed.
  it("reports a batch that does not match the schema as 502", async () => {
    const response = await handlerOver(
      createFakeLlmPort({ response: { questions: GENERATED.questions.slice(0, 2) } }),
    )(postRequest(JSON.stringify({ count: 3 })));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "ERR_LLM_INVALID_OUTPUT",
        message: "The language model could not answer this request.",
      },
    });
  });

  it.each([
    ["ERR_LLM_AUTH", 500],
    ["ERR_LLM_RATE_LIMIT", 429],
    ["ERR_LLM_TIMEOUT", 504],
    ["ERR_LLM_UNAVAILABLE", 503],
  ] as const)("reports %s as %i", async (code, status) => {
    const response = await handlerOver(createFakeLlmPort({ failWith: code }))(
      postRequest(JSON.stringify({ count: 3 })),
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });

  it("rejects a body that is not JSON", async () => {
    const response = await handlerOver(unreachablePort())(
      postRequest("not json at all"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_BAD_REQUEST" },
    });
  });
});
