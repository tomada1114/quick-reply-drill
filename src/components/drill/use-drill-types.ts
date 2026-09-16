import type { DrillRecord } from "@/core/records";
import type { WireQuestion } from "@/core/wire";

import type { QuestionQueueStatus } from "./use-question-queue-types";

export type DrillPhase = "idle" | "answering" | "scoring" | "feedback";

export interface UseDrillResult {
  readonly phase: DrillPhase;
  readonly queueStatus: QuestionQueueStatus;
  readonly queueError: unknown;
  readonly activeQuestion: WireQuestion | undefined;
  readonly reply: string;
  readonly setReply: (value: string) => void;
  readonly remainingMs: number;
  readonly scoreError: unknown;
  readonly submitting: boolean;
  readonly record: DrillRecord | undefined;
  readonly previousRecord: DrillRecord | undefined;
  /** Set when the most recent record could not be written to storage. */
  readonly recordSaveError: unknown;
  readonly onStart: () => void;
  readonly onSend: () => void;
  readonly onRetryScore: () => void;
  readonly onRetryQueue: () => void;
  readonly onNext: () => void;
}
