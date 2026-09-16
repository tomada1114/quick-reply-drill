import type { QuestionsResponse, WireQuestion } from "@/core/wire";

/** The shape `fetchQuestions` from the shared API client has. */
export type FetchQuestions = (
  count: number,
  signal?: AbortSignal,
) => Promise<QuestionsResponse>;

export interface UseQuestionQueueOptions {
  /** Fetches one batch. Injected so a test can stand in for the network. */
  readonly fetchQuestions: FetchQuestions;

  /** How many questions one fetch asks for. */
  readonly batchSize?: number;

  /** Refills once the queue behind `current` drops below this many. */
  readonly refillBelow?: number;
}

/** Where the question queue is in its lifecycle. */
export type QuestionQueueStatus = "loading" | "ready" | "empty" | "error";

export interface UseQuestionQueueResult {
  /** The question a screen should show now. */
  readonly current: WireQuestion | undefined;

  /** Drops `current` and moves to the next queued question. */
  readonly advance: () => void;

  /** The queue's current lifecycle status. */
  readonly status: QuestionQueueStatus;

  /** The most recent fetch failure, or `undefined`. */
  readonly error: unknown;

  /** Retries the initial load or a failed refill. */
  readonly retry: () => void;
}
