import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Drill } from "../src/components/drill/drill";
import {
  createRecordsStore,
  type RecordStorage,
} from "../src/components/lib/records-store";
import { CRITERIA, ITEM_IDS } from "../src/core/rubric";
import type { QuestionsResponse, ScoreResponse, WireQuestion } from "../src/core/wire";

/**
 * `Drill` takes its `storage` prop and every test here passes one, so no
 * assertion ever depends on the `window.localStorage` default — the same
 * isolation `tests/records-store.test.ts` uses for the store underneath it.
 */
class MapStorage implements RecordStorage {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

function makeQuestion(n: number): WireQuestion {
  const label = n.toString();
  return {
    id: `q${label}`,
    question: `Question number ${label}?`,
    scenarioLine: `Scenario ${label}, in a chat.`,
    seed: {
      interlocutorId: "coworker",
      settingId: "office-chat",
      topicId: "scheduling",
    },
  };
}

/** Five questions, matching `useQuestionQueue`'s default batch size. */
const QUESTION_BATCH: QuestionsResponse = {
  questions: [1, 2, 3, 4, 5].map(makeQuestion),
};

/** Every item scored 4/5: each criterion totals 8/10, so the overall total is 80. */
function makeScoreResponse(overrides: Partial<ScoreResponse> = {}): ScoreResponse {
  return {
    rubricVersion: "2026-09.1",
    model: { alias: "gpt-5-mini", reasoningEffort: "low" },
    items: Object.fromEntries(
      ITEM_IDS.map((id) => [id, { rationale: "Solid.", score: 4 }]),
    ) as ScoreResponse["items"],
    comments: Object.fromEntries(
      CRITERIA.map((criterion) => [criterion.id, "Good work."]),
    ) as ScoreResponse["comments"],
    modelReply: "That works for me — see you then.",
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Stubs `fetch` for both of this application's own endpoints, dispatching by
 * path so a test can script `/api/questions` and `/api/score` independently.
 */
function stubFetch(): {
  readonly questionsMock: ReturnType<typeof vi.fn>;
  readonly scoreMock: ReturnType<typeof vi.fn>;
} {
  const questionsMock = vi.fn().mockReturnValue(jsonResponse(200, QUESTION_BATCH));
  const scoreMock = vi.fn();

  vi.stubGlobal(
    "fetch",
    // `./api`'s `postJson` always calls `fetch` with a plain string path, so
    // the stub is typed against that rather than the full `RequestInfo | URL`
    // union `fetch` itself accepts.
    vi.fn((url: string) => {
      if (url.endsWith("/api/questions")) {
        return Promise.resolve(questionsMock() as Response);
      }
      if (url.endsWith("/api/score")) {
        return Promise.resolve(scoreMock() as Response);
      }
      throw new Error(`unexpected fetch to ${url}`);
    }),
  );

  return { questionsMock, scoreMock };
}

/** Lets any pending promise (a stubbed `fetch` call) settle under fake timers. */
async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function renderDrill(storage: RecordStorage): Promise<void> {
  render(<Drill storage={storage} />);
  await flush();
}

function clickStart(): void {
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
}

function typeReply(text: string): void {
  fireEvent.change(screen.getByLabelText("Your reply"), { target: { value: text } });
}

describe("Drill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the first question and the clock once Start is pressed", async () => {
    stubFetch();
    await renderDrill(new MapStorage());

    clickStart();

    expect(screen.getByText("0:30")).toBeInTheDocument();
    expect(screen.getByText("Question number 1?")).toBeInTheDocument();
  });

  it("transitions to feedback with the total computed from the canned sheet on Send", async () => {
    const { scoreMock } = stubFetch();
    scoreMock.mockReturnValueOnce(jsonResponse(200, makeScoreResponse()));
    const storage = new MapStorage();
    await renderDrill(storage);

    clickStart();
    typeReply("Sure, I'm free then.");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await flush();

    expect(screen.getByText("80")).toBeInTheDocument();
    const [record] = createRecordsStore(storage).list();
    expect(record?.forcedSubmit).toBe(false);
    expect(record?.answer).toBe("Sure, I'm free then.");
  });

  it("submits a non-empty reply with forcedSubmit recorded once the clock reaches zero", async () => {
    const { scoreMock } = stubFetch();
    scoreMock.mockReturnValueOnce(jsonResponse(200, makeScoreResponse()));
    const storage = new MapStorage();
    await renderDrill(storage);

    clickStart();
    typeReply("Sure, I'm free then.");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await flush();

    expect(scoreMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("FORCED")).toBeInTheDocument();
    const [record] = createRecordsStore(storage).list();
    expect(record?.forcedSubmit).toBe(true);
    expect(record?.answer).toBe("Sure, I'm free then.");
  });

  it("records zero scores and sends no score request when the field is empty at expiry", async () => {
    const { scoreMock } = stubFetch();
    const storage = new MapStorage();
    await renderDrill(storage);

    clickStart();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await flush();

    expect(scoreMock).not.toHaveBeenCalled();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("FORCED")).toBeInTheDocument();
    const [record] = createRecordsStore(storage).list();
    expect(record?.forcedSubmit).toBe(true);
    expect(record?.scores.answersQuestion).toBe(0);
    expect(record?.rationales.answersQuestion).toBe(
      "No reply was sent before the clock ran out.",
    );
  });

  it("shows the second question on Next without a network round trip", async () => {
    const { questionsMock, scoreMock } = stubFetch();
    scoreMock.mockReturnValueOnce(jsonResponse(200, makeScoreResponse()));
    await renderDrill(new MapStorage());

    clickStart();
    typeReply("Sure, I'm free then.");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Question number 2?")).toBeInTheDocument();
    expect(screen.getByText("0:30")).toBeInTheDocument();
    expect(questionsMock).toHaveBeenCalledTimes(1);
  });

  it("shows a retry affordance on a scoring failure and resubmits the same reply on Retry", async () => {
    const { scoreMock } = stubFetch();
    scoreMock
      .mockReturnValueOnce(
        jsonResponse(504, {
          error: {
            code: "ERR_LLM_TIMEOUT",
            message: "The model did not answer in time.",
          },
        }),
      )
      .mockReturnValueOnce(jsonResponse(200, makeScoreResponse()));
    const storage = new MapStorage();
    await renderDrill(storage);

    clickStart();
    typeReply("Sure, I'm free then.");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await flush();

    expect(
      screen.getByText("The scorer did not answer (ERR_LLM_TIMEOUT). Try again."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await flush();

    expect(scoreMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("80")).toBeInTheDocument();
    const [record] = createRecordsStore(storage).list();
    expect(record?.answer).toBe("Sure, I'm free then.");
  });
});
