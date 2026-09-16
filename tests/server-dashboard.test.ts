import { describe, expect, it } from "vitest";
import type * as z from "zod";

import {
  createFakeLlmPort,
  type LlmError,
  type LlmPort,
  type LlmRequest,
} from "../src/ai/index";
import { POST } from "../src/app/api/dashboard/route";
import { CRITERIA, ITEM_IDS } from "../src/core/rubric";
import type { Result } from "../src/core/result";
import { dashboardResponseSchema, type DashboardRecord } from "../src/core/wire";
import { dashboardHandler } from "../src/server/composition";
import { createDashboardHandler } from "../src/server/handlers/dashboard";

/** The origin a `Request` needs to be constructible; nothing reads the path. */
const ENDPOINT = "http://localhost/api/dashboard";

/** The most records one request may carry, mirroring `MAX_DASHBOARD_RECORDS`. */
const MAX_DASHBOARD_RECORDS = 10;

/** One record, for a case to vary a single field of. */
function record(overrides: Partial<DashboardRecord> = {}): DashboardRecord {
  return {
    recordedAt: "2026-09-01T00:00:00.000Z",
    question: {
      text: "Are you free for lunch tomorrow?",
      scenarioLine: "A coworker, in a direct message",
    },
    answer: "Sure, tomorrow works. Where do you want to go?",
    scores: Object.fromEntries(
      ITEM_IDS.map((id) => [id, 4]),
    ) as DashboardRecord["scores"],
    comments: Object.fromEntries(
      CRITERIA.map((criterion) => [criterion.id, "Change this."]),
    ) as DashboardRecord["comments"],
    rubricVersion: "2026-09.1",
    ...overrides,
  };
}

/** One well-formed request body, for a case to vary. */
const INPUT = { records: [record()] };

/** What the model is asked to answer with. */
const SUMMARISED = { summary: "A steady paragraph about the four criteria." };

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

/** A handler over `llm`. */
function handlerOver(llm: LlmPort): (request: Request) => Promise<Response> {
  return createDashboardHandler({ llm });
}

/** A `POST` carrying `body` verbatim, however malformed it is. */
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

describe("POST /api/dashboard", () => {
  it("is what the Route Handler publishes, so the composed handler is the one served", () => {
    expect(POST).toBe(dashboardHandler);
  });

  it("answers a well-formed set of records with the summary the model wrote", async () => {
    const response = await handlerOver(createFakeLlmPort({ response: SUMMARISED }))(
      postRequest(JSON.stringify(INPUT)),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const answer = dashboardResponseSchema.parse(await response.json());
    expect(answer).toStrictEqual(SUMMARISED);
  });

  it("hands the port every record's reply", async () => {
    const seen: CapturedRequest[] = [];
    const records = [
      record({ answer: "Sure, tomorrow works." }),
      record({
        recordedAt: "2026-09-02T00:00:00.000Z",
        answer: "I will send it tomorrow.",
      }),
    ];

    await handlerOver(capturing(createFakeLlmPort({ response: SUMMARISED }), seen))(
      postRequest(JSON.stringify({ records })),
    );

    expect(seen).toHaveLength(1);
    for (const one of records) {
      expect(seen[0]?.prompt).toContain(one.answer);
    }
  });

  it("forwards the caller's cancellation to the port", async () => {
    const seen: CapturedRequest[] = [];
    const controller = new AbortController();

    await handlerOver(capturing(createFakeLlmPort({ response: SUMMARISED }), seen))(
      postRequest(JSON.stringify(INPUT), { signal: controller.signal }),
    );
    const forwarded = seen[0]?.signal;
    expect(forwarded?.aborted).toBe(false);

    controller.abort();

    expect(forwarded?.aborted).toBe(true);
  });

  it("refuses a request that does not identify itself as same-origin", async () => {
    const response = await handlerOver(unreachablePort())(
      new Request(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(INPUT),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toStrictEqual({
      error: {
        code: "ERR_FORBIDDEN_ORIGIN",
        message: "This endpoint answers same-origin browser requests only.",
      },
    });
  });

  it.each(["cross-site", "same-site"] as const)(
    "refuses a %s request",
    async (site) => {
      const response = await handlerOver(unreachablePort())(
        postRequest(JSON.stringify(INPUT), {
          headers: { "content-type": "application/json", "sec-fetch-site": site },
        }),
      );

      expect(response.status).toBe(403);
    },
  );

  it("refuses an empty records array without reaching the port", async () => {
    const response = await handlerOver(unreachablePort())(
      postRequest(JSON.stringify({ records: [] })),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_BAD_REQUEST" },
    });
  });

  it("accepts exactly the record ceiling", async () => {
    const records = Array.from({ length: MAX_DASHBOARD_RECORDS }, (_unused, index) =>
      record({
        recordedAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    );

    const response = await handlerOver(createFakeLlmPort({ response: SUMMARISED }))(
      postRequest(JSON.stringify({ records })),
    );

    expect(response.status).toBe(200);
  });

  it("refuses one record over the ceiling without reaching the port", async () => {
    const records = Array.from(
      { length: MAX_DASHBOARD_RECORDS + 1 },
      (_unused, index) =>
        record({
          recordedAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        }),
    );

    const response = await handlerOver(unreachablePort())(
      postRequest(JSON.stringify({ records })),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_BAD_REQUEST" },
    });
  });

  it("refuses records that mix rubricVersion without reaching the port", async () => {
    const records = [
      record({ rubricVersion: "2026-09.1" }),
      record({ rubricVersion: "2026-08.1" }),
    ];

    const response = await handlerOver(unreachablePort())(
      postRequest(JSON.stringify({ records })),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_BAD_REQUEST" },
    });
  });

  it.each([
    ["a body that is not an object", [INPUT]],
    ["a body missing records", {}],
    ["a record missing a field", { records: [{ ...record(), answer: undefined }] }],
  ])("refuses %s without reaching the port", async (_case, body) => {
    const response = await handlerOver(unreachablePort())(
      postRequest(JSON.stringify(body)),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ERR_BAD_REQUEST" },
    });
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

  it("reports an answer that does not match the schema as 502", async () => {
    const response = await handlerOver(
      createFakeLlmPort({ response: { summary: 42 } }),
    )(postRequest(JSON.stringify(INPUT)));

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
      postRequest(JSON.stringify(INPUT)),
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });
});
