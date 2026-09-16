"use client";

import Link from "next/link";
import { useEffect, useState, type ReactElement } from "react";

import { DrillCard } from "@/components/drill/card";
import { BODY_TEXT_CLASS_NAME } from "@/components/drill/format";
import { createRecordsStore, type RecordStorage } from "@/components/lib/records-store";
import type { DrillRecord } from "@/core/records";

import { DashboardContent } from "./dashboard-content";

interface DashboardProps {
  /** Where records are read from. Defaults to `window.localStorage`. */
  readonly storage?: RecordStorage;
}

/**
 * The dashboard screen: the recent-runs table, the total's sparkline, and the
 * AI summary control, all read from the learner's own `localStorage`-backed
 * history.
 *
 * @remarks
 * The read happens inside an effect, never during render:
 * `window.localStorage` does not exist during this Client Component's
 * server-side render pass, the same reason `use-drill.ts` defers every store
 * read to an event handler rather than the render body. The read itself is
 * synchronous, but `setRecords` is still called from inside a resolved
 * microtask rather than as the effect's first statement — the same shape
 * `use-question-queue.ts`'s mount effect uses for its own (genuinely async)
 * fetch — so a synchronous read never triggers
 * `react-hooks/set-state-in-effect`'s cascading-render warning, and the
 * `cancelled` guard keeps a slow test or a fast unmount from calling
 * `setRecords` after this component is gone.
 */
export function Dashboard({ storage }: DashboardProps): ReactElement {
  const [records, setRecords] = useState<DrillRecord[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }
      // Blocked site data throws from the `window.localStorage` getter itself,
      // and a failing store throws from `getItem`; either reads as no history
      // rather than a crashed page or a "Loading…" that never resolves.
      let list: DrillRecord[];
      try {
        list = createRecordsStore(storage ?? window.localStorage).list();
      } catch {
        list = [];
      }
      setRecords(list);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  return (
    <main className="flex min-h-[70svh] flex-col items-center py-8">
      <div className="flex w-full max-w-[720px] flex-col gap-4">
        <Link href="/" className="self-start font-sans text-caption">
          Back to the drill
        </Link>
        <DrillCard>
          <h1 className="font-mono text-micro uppercase text-slate">DASHBOARD</h1>
          {records === undefined ? (
            <p className="font-sans text-caption text-slate">Loading…</p>
          ) : records.length === 0 ? (
            <p className={BODY_TEXT_CLASS_NAME}>
              No reps yet. <Link href="/">Start one</Link>.
            </p>
          ) : (
            <DashboardContent records={records} />
          )}
        </DrillCard>
      </div>
    </main>
  );
}
