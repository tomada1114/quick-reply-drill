import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Drill } from "../src/components/drill/drill";
import {
  createRecordsStore,
  type RecordStorage,
} from "../src/components/lib/records-store";
import { CRITERIA, ITEM_IDS } from "../src/core/rubric";
import {
  MAX_SCORE_ANSWER_LENGTH,
  type QuestionsResponse,
  type ScoreResponse,
  type WireQuestion,
} from "../src/core/wire";

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

/**
 * A `RecordStorage` whose every write fails, the way a full quota or a
 * blocked/private-mode `localStorage` would — for asserting that a rep still
 * reaches feedback (F2) even when persisting it does not work.
 */
class ThrowingStorage implements RecordStorage {
  getItem(): string | null {
    return null;
  }

  setItem(): void {
    throw new Error("storage is not available");
  }

  removeItem(): void {
    // Nothing was ever written; nothing to remove.
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

function setNavigatorPlatform(platform: string): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(window.navigator, "platform");
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: platform,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(window.navigator, "platform", descriptor);
    } else {
      delete (window.navigator as { platform?: string }).platform;
    }
  };
}

function setNavigatorTouchPoints(maxTouchPoints: number): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.navigator,
    "maxTouchPoints",
  );
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(window.navigator, "maxTouchPoints", descriptor);
    } else {
      delete (window.navigator as { maxTouchPoints?: number }).maxTouchPoints;
    }
  };
}

function setNavigatorUserAgent(userAgent: string): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(window.navigator, "userAgent");
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(window.navigator, "userAgent", descriptor);
    } else {
      delete (window.navigator as { userAgent?: string }).userAgent;
    }
  };
}

/**
 * A sheet whose items all differ, so an axis or a row bound to the wrong item
 * shows a wrong number, and whose comments name their criterion.
 */
function makeVariedScoreResponse(): ScoreResponse {
  return makeScoreResponse({
    items: {
      respondsToPartner: { rationale: "Solid.", score: 5 },
      keepsItGoing: { rationale: "Solid.", score: 2 },
      grammar: { rationale: "Solid.", score: 4 },
      spellingPunctuation: { rationale: "Solid.", score: 3 },
      wordChoice: { rationale: "Solid.", score: 4 },
      collocation: { rationale: "Solid.", score: 4 },
      toneRegister: { rationale: "Solid.", score: 1 },
      chatForm: { rationale: "Solid.", score: 5 },
    },
    comments: {
      conversation: "Conversation comment.",
      accuracy: "Accuracy comment.",
      vocabulary: "Vocabulary comment.",
      appropriateness: "Fit comment.",
    },
  });
}

/** The collapsible section whose summary names `label`. */
function detailsSection(label: string): HTMLElement {
  const section = screen.getByText(label).closest("details");
  expect(section).toBeInstanceOf(HTMLDetailsElement);
  return section as HTMLElement;
}

/** Starts a rep, sends a reply, and lets the stubbed score response land. */
async function reachFeedback(): Promise<void> {
  clickStart();
  typeReply("Sure, I'm free then.");
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await flush();
}

describe("Drill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("links to the dashboard, under the card and outside it", async () => {
    stubFetch();
    await renderDrill(new MapStorage());

    expect(screen.getByRole("link", { name: "View your dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("shows the first question and the clock once Start is pressed", async () => {
    stubFetch();
    await renderDrill(new MapStorage());

    clickStart();

    expect(screen.getByText("1:00")).toBeInTheDocument();
    expect(screen.getByText("Question number 1?")).toBeInTheDocument();
  });

  it("shows a pointer cursor on an enabled Send control", async () => {
    stubFetch();
    await renderDrill(new MapStorage());

    clickStart();
    typeReply("Sure, I'm free then.");

    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toBeEnabled();
    expect(sendButton).toHaveClass("cursor-pointer");
  });

  it("keeps scoring-only treatment out of the answering state", async () => {
    stubFetch();
    await renderDrill(new MapStorage());

    clickStart();
    typeReply("Sure, I'm free then.");

    expect(screen.getByLabelText("Your reply")).toBeEnabled();
    expect(
      screen.queryByRole("status", { name: "Scoring your reply" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("STOPPED", { exact: true })).not.toBeInTheDocument();
  });

  it("sends a non-empty reply with Ctrl+Enter and shows the shortcut hint", async () => {
    const { scoreMock } = stubFetch();
    let resolveScore: ((response: Response) => void) | undefined;
    scoreMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveScore = resolve;
      }),
    );
    await renderDrill(new MapStorage());

    clickStart();
    typeReply("Sure, I'm free then.");
    expect(
      screen.getByText("Reply in one or two sentences. Ctrl+Enter to send"),
    ).toBeInTheDocument();

    const textarea = screen.getByLabelText("Your reply");
    expect(textarea).toHaveAttribute("aria-describedby", "answering-shortcut-hint");
    expect(textarea).toHaveAttribute("aria-keyshortcuts", "Control+Enter");
    expect(
      screen.getByText("Reply in one or two sentences. Ctrl+Enter to send"),
    ).toHaveAttribute("id", "answering-shortcut-hint");
    fireEvent.keyDown(textarea, { code: "Enter", ctrlKey: true, key: "Enter" });
    expect(scoreMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(textarea, { code: "Enter", ctrlKey: true, key: "Enter" });
    expect(scoreMock).toHaveBeenCalledTimes(1);

    resolveScore?.(jsonResponse(200, makeScoreResponse()));
    await flush();
  });

  it("ignores the shortcut for an empty or whitespace reply and preserves plain Enter", async () => {
    const { scoreMock } = stubFetch();
    await renderDrill(new MapStorage());

    clickStart();
    const textarea = screen.getByLabelText("Your reply");
    fireEvent.keyDown(textarea, { code: "Enter", ctrlKey: true, key: "Enter" });
    typeReply("   ");
    fireEvent.keyDown(textarea, { code: "Enter", ctrlKey: true, key: "Enter" });
    typeReply("A reply with a newline still belongs in the field.");
    const plainEnter = createEvent.keyDown(textarea, { code: "Enter", key: "Enter" });
    fireEvent(textarea, plainEnter);

    expect(scoreMock).not.toHaveBeenCalled();
    expect(plainEnter.defaultPrevented).toBe(false);
    expect(textarea).toHaveValue("A reply with a newline still belongs in the field.");
  });

  it("uses the Meta+Enter shortcut on Mac platforms", async () => {
    const restorePlatform = setNavigatorPlatform("MacIntel");
    try {
      const { scoreMock } = stubFetch();
      scoreMock.mockReturnValueOnce(jsonResponse(200, makeScoreResponse()));
      await renderDrill(new MapStorage());

      clickStart();
      typeReply("Sure, I'm free then.");
      expect(
        screen.getByText("Reply in one or two sentences. ⌘↵ to send"),
      ).toBeInTheDocument();

      const textarea = screen.getByLabelText("Your reply");
      expect(textarea).toHaveAttribute("aria-keyshortcuts", "Meta+Enter");
      fireEvent.keyDown(textarea, { code: "Enter", ctrlKey: true, key: "Enter" });
      expect(scoreMock).not.toHaveBeenCalled();

      fireEvent.keyDown(textarea, { code: "Enter", key: "Enter", metaKey: true });
      await flush();
      expect(scoreMock).toHaveBeenCalledTimes(1);
    } finally {
      restorePlatform();
    }
  });

  it("keeps the Ctrl shortcut on non-Mac Apple platforms", async () => {
    const restorePlatform = setNavigatorPlatform("iPhone");
    try {
      const { scoreMock } = stubFetch();
      scoreMock.mockReturnValueOnce(jsonResponse(200, makeScoreResponse()));
      await renderDrill(new MapStorage());

      clickStart();
      typeReply("Sure, I'm free then.");
      expect(
        screen.getByText("Reply in one or two sentences. Ctrl+Enter to send"),
      ).toBeInTheDocument();

      const textarea = screen.getByLabelText("Your reply");
      fireEvent.keyDown(textarea, { code: "Enter", key: "Enter", metaKey: true });
      expect(scoreMock).not.toHaveBeenCalled();

      fireEvent.keyDown(textarea, { code: "Enter", ctrlKey: true, key: "Enter" });
      await flush();
      expect(scoreMock).toHaveBeenCalledTimes(1);
    } finally {
      restorePlatform();
    }
  });

  it("keeps the Ctrl shortcut in iPad desktop mode", async () => {
    const restorePlatform = setNavigatorPlatform("MacIntel");
    const restoreTouchPoints = setNavigatorTouchPoints(5);
    try {
      const { scoreMock } = stubFetch();
      scoreMock.mockReturnValueOnce(jsonResponse(200, makeScoreResponse()));
      await renderDrill(new MapStorage());

      clickStart();
      typeReply("Sure, I'm free then.");
      expect(
        screen.getByText("Reply in one or two sentences. Ctrl+Enter to send"),
      ).toBeInTheDocument();
    } finally {
      restoreTouchPoints();
      restorePlatform();
    }
  });

  it("keeps the Ctrl shortcut on a one-touch Mac-reported device", async () => {
    const restorePlatform = setNavigatorPlatform("MacIntel");
    const restoreTouchPoints = setNavigatorTouchPoints(1);
    try {
      const { scoreMock } = stubFetch();
      scoreMock.mockReturnValueOnce(jsonResponse(200, makeScoreResponse()));
      await renderDrill(new MapStorage());

      clickStart();
      typeReply("Sure, I'm free then.");
      expect(
        screen.getByText("Reply in one or two sentences. Ctrl+Enter to send"),
      ).toBeInTheDocument();

      const textarea = screen.getByLabelText("Your reply");
      fireEvent.keyDown(textarea, { code: "Enter", key: "Enter", metaKey: true });
      expect(scoreMock).not.toHaveBeenCalled();

      fireEvent.keyDown(textarea, { code: "Enter", ctrlKey: true, key: "Enter" });
      await flush();
      expect(scoreMock).toHaveBeenCalledTimes(1);
    } finally {
      restoreTouchPoints();
      restorePlatform();
    }
  });

  it("recognizes a Mac user agent when the platform value is empty", async () => {
    const restorePlatform = setNavigatorPlatform("");
    const restoreUserAgent = setNavigatorUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
    );
    try {
      const { scoreMock } = stubFetch();
      scoreMock.mockReturnValueOnce(jsonResponse(200, makeScoreResponse()));
      await renderDrill(new MapStorage());

      clickStart();
      typeReply("Sure, I'm free then.");
      expect(
        screen.getByText("Reply in one or two sentences. ⌘↵ to send"),
      ).toBeInTheDocument();
    } finally {
      restoreUserAgent();
      restorePlatform();
    }
  });

  it("keeps Start disabled while questions load and enables it when ready", async () => {
    let resolveQuestions: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/api/questions")) {
          return new Promise<Response>((resolve) => {
            resolveQuestions = resolve;
          });
        }
        throw new Error(`unexpected fetch to ${url}`);
      }),
    );

    await renderDrill(new MapStorage());

    expect(
      screen.getByText("One question, a timed reply, then feedback."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
    expect(
      screen.getByRole("status", { name: "Loading questions" }),
    ).toBeInTheDocument();

    resolveQuestions?.(jsonResponse(200, QUESTION_BATCH));
    await flush();

    expect(screen.getByRole("button", { name: "Start" })).not.toBeDisabled();
    expect(
      screen.queryByRole("status", { name: "Loading questions" }),
    ).not.toBeInTheDocument();
  });

  it("shows Retry and the queue error when the initial question load fails", async () => {
    const { questionsMock } = stubFetch();
    questionsMock.mockReturnValueOnce(
      jsonResponse(504, {
        error: {
          code: "ERR_LLM_TIMEOUT",
          message: "The model did not answer in time.",
        },
      }),
    );
    await renderDrill(new MapStorage());

    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(
      screen.getByText("The question queue did not load (ERR_LLM_TIMEOUT). Try again."),
    ).toBeInTheDocument();
  });

  it("shows a loading indicator while a reply is being scored", async () => {
    const { scoreMock } = stubFetch();
    let resolveScore: ((response: Response) => void) | undefined;
    scoreMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveScore = resolve;
      }),
    );
    await renderDrill(new MapStorage());

    clickStart();
    typeReply("Sure, I'm free then.");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(
      screen.getByRole("status", { name: "Scoring your reply" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Your reply")).toBeDisabled();
    expect(screen.getByText("STOPPED", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    resolveScore?.(jsonResponse(200, makeScoreResponse()));
    await flush();

    expect(
      screen.queryByRole("status", { name: "Scoring your reply" }),
    ).not.toBeInTheDocument();
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
      await vi.advanceTimersByTimeAsync(60_000);
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
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await flush();

    expect(scoreMock).not.toHaveBeenCalled();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("FORCED")).toBeInTheDocument();
    const [record] = createRecordsStore(storage).list();
    expect(record?.forcedSubmit).toBe(true);
    expect(record?.scores.respondsToPartner).toBe(0);
    expect(record?.rationales.respondsToPartner).toBe(
      "No reply was sent before the clock ran out.",
    );
  });

  it("draws the eight sub-scores as a radar with one labeled axis per rubric item", async () => {
    const { scoreMock } = stubFetch();
    scoreMock.mockReturnValueOnce(jsonResponse(200, makeVariedScoreResponse()));
    await renderDrill(new MapStorage());

    await reachFeedback();

    const radar = screen.getByRole("img", {
      name:
        "Sub-scores out of 5: Responds to the partner 5 of 5, Keeps it going 2 of 5, " +
        "Grammar 4 of 5, Spelling and punctuation 3 of 5, Word choice 4 of 5, " +
        "Collocation, no translated-sounding phrasing 4 of 5, " +
        "Tone and politeness for the relationship 1 of 5, " +
        "Length and shape for a chat reply 5 of 5.",
    });
    const axes = [...radar.querySelectorAll('[data-slot="radar-axis"]')].map((axis) =>
      [...axis.querySelectorAll("tspan")].map((line) => line.textContent),
    );
    expect(axes).toEqual([
      ["CONVERSATION", "Responds"],
      ["CONVERSATION", "Keeps going"],
      ["ACCURACY", "Grammar"],
      ["ACCURACY", "Spelling"],
      ["VOCABULARY", "Word choice"],
      ["VOCABULARY", "Collocation"],
      ["FIT", "Tone"],
      ["FIT", "Chat form"],
    ]);
  });

  it("starts every criterion's details collapsed", async () => {
    const { scoreMock } = stubFetch();
    scoreMock.mockReturnValueOnce(jsonResponse(200, makeVariedScoreResponse()));
    await renderDrill(new MapStorage());

    await reachFeedback();

    for (const label of [
      "Keeps the conversation going",
      "Accuracy",
      "Vocabulary and naturalness",
      "Fit for the situation",
    ]) {
      expect(detailsSection(label)).not.toHaveAttribute("open");
    }
    const accuracy = within(detailsSection("Accuracy"));
    expect(accuracy.getByText("Spelling and punctuation")).not.toBeVisible();
    expect(accuracy.getByText("Accuracy comment.")).not.toBeVisible();
  });

  it.each([
    [
      "Keeps the conversation going",
      "7 / 10",
      [
        ["Responds to the partner", "5 / 5"],
        ["Keeps it going", "2 / 5"],
      ],
      "Conversation comment.",
    ],
    [
      "Accuracy",
      "7 / 10",
      [
        ["Grammar", "4 / 5"],
        ["Spelling and punctuation", "3 / 5"],
      ],
      "Accuracy comment.",
    ],
    [
      "Vocabulary and naturalness",
      "8 / 10",
      [
        ["Word choice", "4 / 5"],
        ["Collocation, no translated-sounding phrasing", "4 / 5"],
      ],
      "Vocabulary comment.",
    ],
    [
      "Fit for the situation",
      "6 / 10",
      [
        ["Tone and politeness for the relationship", "1 / 5"],
        ["Length and shape for a chat reply", "5 / 5"],
      ],
      "Fit comment.",
    ],
  ] as const)(
    "opens %s to show its sub-scores and comment",
    async (label, subtotal, items, comment) => {
      const { scoreMock } = stubFetch();
      scoreMock.mockReturnValueOnce(jsonResponse(200, makeVariedScoreResponse()));
      await renderDrill(new MapStorage());
      await reachFeedback();

      const section = detailsSection(label);
      expect(section.querySelector("summary")).toHaveTextContent(subtotal);
      fireEvent.click(within(section).getByText(label));

      expect(section).toHaveAttribute("open");
      for (const [itemLabel, score] of items) {
        const row = within(section).getByText(itemLabel);
        expect(row).toBeVisible();
        expect(row.parentElement).toHaveTextContent(score);
      }
      expect(within(section).getByText(comment)).toBeVisible();
    },
  );

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
    expect(screen.getByText("1:00")).toBeInTheDocument();
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
    fireEvent.keyDown(screen.getByLabelText("Your reply"), {
      code: "Enter",
      ctrlKey: true,
      key: "Enter",
    });
    expect(scoreMock).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("status", { name: "Scoring your reply" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await flush();

    expect(scoreMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("80")).toBeInTheDocument();
    const [record] = createRecordsStore(storage).list();
    expect(record?.answer).toBe("Sure, I'm free then.");
  });

  it("caps the reply at the wire ceiling so an over-length paste cannot trap a retry loop", async () => {
    const { scoreMock } = stubFetch();
    scoreMock.mockReturnValueOnce(jsonResponse(200, makeScoreResponse()));
    await renderDrill(new MapStorage());

    clickStart();
    typeReply("x".repeat(MAX_SCORE_ANSWER_LENGTH + 100));

    expect(screen.getByLabelText("Your reply")).toHaveValue(
      "x".repeat(MAX_SCORE_ANSWER_LENGTH),
    );

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await flush();

    expect(screen.getByText("80")).toBeInTheDocument();
  });

  it("shows feedback for a graded reply even when the record store cannot persist it", async () => {
    const { scoreMock } = stubFetch();
    scoreMock.mockReturnValueOnce(jsonResponse(200, makeScoreResponse()));
    await renderDrill(new ThrowingStorage());

    clickStart();
    typeReply("Sure, I'm free then.");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await flush();

    expect(scoreMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(
      screen.getByText("This score was not saved to your local history."),
    ).toBeInTheDocument();
  });

  it("shows feedback for a forced-empty record even when the record store cannot persist it", async () => {
    const { scoreMock } = stubFetch();
    await renderDrill(new ThrowingStorage());

    clickStart();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await flush();

    expect(scoreMock).not.toHaveBeenCalled();
    expect(screen.getByText("FORCED")).toBeInTheDocument();
    expect(
      screen.getByText("This score was not saved to your local history."),
    ).toBeInTheDocument();
  });

  it("shows the idle screen as waiting, not failed, while a background refill is still in flight", async () => {
    // A fresh `Response` per call, not `mockReturnValue`: a `Response` body
    // can only be read once, and this stub answers `/api/score` five times.
    const scoreMock = vi.fn(() => jsonResponse(200, makeScoreResponse()));
    let resolveRefill: ((value: Response) => void) | undefined;
    let questionsCallCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/api/questions")) {
          questionsCallCount += 1;
          if (questionsCallCount === 1) {
            return Promise.resolve(jsonResponse(200, QUESTION_BATCH));
          }
          // The refill triggered once the last queued question reached the
          // screen: left pending so the queue can actually drain to empty
          // before it resolves.
          return new Promise<Response>((resolve) => {
            resolveRefill = resolve;
          });
        }
        if (url.endsWith("/api/score")) {
          return Promise.resolve(scoreMock());
        }
        throw new Error(`unexpected fetch to ${url}`);
      }),
    );
    await renderDrill(new MapStorage());

    clickStart();
    // Answer and advance through the whole five-question batch so the queue
    // drains to zero while its one automatic refill is still unresolved.
    for (let rep = 0; rep < 5; rep += 1) {
      typeReply("Sure, I'm free then.");
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      await flush();
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }

    expect(
      screen.getByRole("status", { name: "Loading questions" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByText(/ERR_UNKNOWN/)).not.toBeInTheDocument();

    resolveRefill?.(jsonResponse(200, QUESTION_BATCH));
    await flush();

    expect(screen.getByText("Question number 1?")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Loading questions" }),
    ).not.toBeInTheDocument();
  });
});
