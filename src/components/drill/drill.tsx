"use client";

import type { ReactElement } from "react";

import type { RecordStorage } from "@/components/lib/records-store";

import { AnsweringCard } from "./answering-card";
import { Feedback } from "./feedback";
import { IdleScreen } from "./idle-screen";
import { useDrill } from "./use-drill";

interface DrillProps {
  /** Where a completed rep is recorded. Defaults to `window.localStorage`. */
  readonly storage?: RecordStorage;
}

/**
 * The drill screen: `idle → answering → scoring → feedback`, rendering
 * whichever of the three screens `useDrill`'s `phase` names. All of the
 * state machine lives in `./use-drill`; this file is the JSX composing it.
 */
export function Drill({ storage }: DrillProps): ReactElement {
  const drill = useDrill(storage);

  return (
    <main className="flex min-h-[70svh] flex-col items-center justify-center">
      <div className="w-full max-w-[720px]">
        {drill.phase === "idle" ? (
          <IdleScreen
            status={drill.queueStatus}
            error={drill.queueError}
            onStart={drill.onStart}
            onRetry={drill.onRetryQueue}
          />
        ) : null}
        {(drill.phase === "answering" || drill.phase === "scoring") &&
        drill.activeQuestion ? (
          <AnsweringCard
            key={drill.activeQuestion.id}
            question={drill.activeQuestion}
            remainingMs={drill.remainingMs}
            reply={drill.reply}
            onReplyChange={drill.setReply}
            onSend={drill.onSend}
            onRetry={drill.onRetryScore}
            submitting={drill.submitting}
            scoreError={drill.scoreError}
          />
        ) : null}
        {drill.phase === "feedback" && drill.record ? (
          <Feedback
            record={drill.record}
            previous={drill.previousRecord}
            onNext={drill.onNext}
          />
        ) : null}
      </div>
    </main>
  );
}
