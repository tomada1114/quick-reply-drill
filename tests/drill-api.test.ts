import { describe, expect, it, vi } from "vitest";

import {
  ApiError,
  fetchDashboardSummary,
  fetchQuestions,
  submitForScoring,
} from "../src/components/drill/api";
import { CRITERIA, ITEM_IDS } from "../src/core/rubric";
import {
  MAX_DASHBOARD_RECORDS,
  MAX_QUESTIONS_PER_BATCH,
  MAX_SCORE_ANSWER_LENGTH,
  type DashboardRecord,
  type QuestionsResponse,
  type ScoreRequest,
  type ScoreResponse,
} from "../src/core/wire";

/** Builds a `Response` carrying a JSON body, the way `fetch` would deliver one. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A single valid question batch, for a case that only needs one. */
const VALID_QUESTIONS: QuestionsResponse = {
  questions: [
    {
      id: "q1",
      question: "Are you free Friday afternoon?",
      scenarioLine: "Your coworker Maya asks over chat.",
      seed: {
        interlocutorId: "coworker",
        settingId: "office-chat",
        topicId: "scheduling",
      },
    },
  ],
};

/** One well-formed score request body. */
const SCORE_REQUEST: ScoreRequest = {
  question: "Are you free for lunch tomorrow?",
  scenarioLine: "A coworker, in a direct message",
  answer: "Sure, tomorrow works. Where do you want to go?",
};

/** One schema-valid dashboard record. */
function makeDashboardRecord(
  overrides: Partial<DashboardRecord> = {},
): DashboardRecord {
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
    rubricVersion: "2026-09.2",
    ...overrides,
  };
}

/** A full, schema-valid score answer: eight items, four comments. */
const VALID_SCORE: ScoreResponse = {
  rubricVersion: "2026-09.1",
  model: { alias: "gpt-5-mini", reasoningEffort: "low" },
  items: Object.fromEntries(
    ITEM_IDS.map((id) => [id, { rationale: "Concrete reason.", score: 4 }]),
  ) as ScoreResponse["items"],
  comments: Object.fromEntries(
    CRITERIA.map((criterion) => [criterion.id, "Change this."]),
  ) as ScoreResponse["comments"],
  modelReply: "Sure, tomorrow works for me. Where would you like to go?",
};

describe("fetchQuestions", () => {
  it("parses a valid response body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, VALID_QUESTIONS));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchQuestions(1)).resolves.toStrictEqual(VALID_QUESTIONS);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/questions",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({ count: 1 }),
      }),
    );
  });

  it("forwards the given signal to fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, VALID_QUESTIONS));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await fetchQuestions(1, controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/questions",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("rejects a response body that does not match questionsResponseSchema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { questions: "not-an-array" })),
    );

    await expect(fetchQuestions(1)).rejects.toThrow();
  });

  it("rejects a count above MAX_QUESTIONS_PER_BATCH before a request is sent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchQuestions(MAX_QUESTIONS_PER_BATCH + 1)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a 403 error envelope to an ApiError carrying its status and code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(403, {
          error: {
            code: "ERR_FORBIDDEN_ORIGIN",
            message: "This endpoint answers same-origin browser requests only.",
          },
        }),
      ),
    );

    const error: unknown = await fetchQuestions(1).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).code).toBe("ERR_FORBIDDEN_ORIGIN");
  });

  it("maps a non-2xx body that is not the expected envelope to a fixed code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(500, { oops: true })),
    );

    const error: unknown = await fetchQuestions(1).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).code).toBe("ERR_UNKNOWN_RESPONSE");
  });

  it("maps a non-2xx body that is not JSON at all to a fixed code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not json", { status: 502 })),
    );

    const error: unknown = await fetchQuestions(1).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).code).toBe("ERR_UNKNOWN_RESPONSE");
  });

  it("maps a 2xx body that is not JSON at all to an ApiError, not a raw parse error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>not json</html>", { status: 200 })),
    );

    const error: unknown = await fetchQuestions(1).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(200);
    expect((error as ApiError).code).toBe("ERR_UNKNOWN_RESPONSE");
  });
});

describe("submitForScoring", () => {
  it("parses a valid response body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, VALID_SCORE));
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitForScoring(SCORE_REQUEST)).resolves.toStrictEqual(VALID_SCORE);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/score",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify(SCORE_REQUEST),
      }),
    );
  });

  it("rejects a response body that does not match scoreResponseSchema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { rubricVersion: "2026-09.1" })),
    );

    await expect(submitForScoring(SCORE_REQUEST)).rejects.toThrow();
  });

  it("maps a 429 error envelope to an ApiError carrying its status and code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(429, {
          error: {
            code: "ERR_LLM_RATE_LIMIT",
            message: "The language model could not answer this request.",
          },
        }),
      ),
    );

    const error: unknown = await submitForScoring(SCORE_REQUEST).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(429);
    expect((error as ApiError).code).toBe("ERR_LLM_RATE_LIMIT");
  });

  it("rejects a whitespace-only answer before a request is sent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitForScoring({ ...SCORE_REQUEST, answer: "   " }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an answer over MAX_SCORE_ANSWER_LENGTH before a request is sent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitForScoring({
        ...SCORE_REQUEST,
        answer: "a".repeat(MAX_SCORE_ANSWER_LENGTH + 1),
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trims the answer before sending, matching what the server's schema would trim it to", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, VALID_SCORE));
    vi.stubGlobal("fetch", fetchMock);

    await submitForScoring({ ...SCORE_REQUEST, answer: "  padded reply  " });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/score",
      expect.objectContaining({
        body: JSON.stringify({ ...SCORE_REQUEST, answer: "padded reply" }),
      }),
    );
  });
});

describe("fetchDashboardSummary", () => {
  it("parses a valid response body", async () => {
    const records = [makeDashboardRecord()];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { summary: "You're trending up." }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchDashboardSummary(records)).resolves.toStrictEqual({
      summary: "You're trending up.",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({ records }),
      }),
    );
  });

  it("forwards the given signal to fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { summary: "Steady." }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await fetchDashboardSummary([makeDashboardRecord()], controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("rejects a response body that does not match dashboardResponseSchema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { paragraph: "wrong key" })),
    );

    await expect(fetchDashboardSummary([makeDashboardRecord()])).rejects.toThrow();
  });

  it("rejects an empty records array before a request is sent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchDashboardSummary([])).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects more than MAX_DASHBOARD_RECORDS records before a request is sent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const tooMany = Array.from({ length: MAX_DASHBOARD_RECORDS + 1 }, () =>
      makeDashboardRecord(),
    );

    await expect(fetchDashboardSummary(tooMany)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects records that mix rubricVersion before a request is sent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const mixed = [
      makeDashboardRecord({ rubricVersion: "2026-09.2" }),
      makeDashboardRecord({ rubricVersion: "2026-09.1" }),
    ];

    await expect(fetchDashboardSummary(mixed)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a 429 error envelope to an ApiError carrying its status and code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(429, {
          error: {
            code: "ERR_LLM_RATE_LIMIT",
            message: "The language model could not answer this request.",
          },
        }),
      ),
    );

    const error: unknown = await fetchDashboardSummary([makeDashboardRecord()]).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(429);
    expect((error as ApiError).code).toBe("ERR_LLM_RATE_LIMIT");
  });
});
