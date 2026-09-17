"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";

import { fetchDashboardSummary } from "@/components/shared/api";
import { Caption } from "@/components/shared/caption";
import { describeApiError } from "@/components/shared/format";
import { LoadingIndicator } from "@/components/shared/loading-indicator";
import { Button } from "@/components/ui/button";
import type { DrillRecord } from "@/core/records";

import { toDashboardRecord } from "./dashboard-view";

interface SummaryPanelProps {
  /** Newest first, one rubric version, already capped at the wire ceiling. */
  readonly records: readonly DrillRecord[];
}

type SummaryState =
  | { readonly status: "idle" | "pending" }
  | { readonly status: "error"; readonly error: unknown }
  | { readonly status: "done"; readonly summary: string };

/**
 * The one filled control on the dashboard: asks `POST /api/dashboard` for a
 * trend paragraph over `records` and renders it below on success.
 *
 * @remarks
 * Nothing from this call is persisted — the dashboard reads its history from
 * `localStorage` alone, and a fresh press always rebuilds the request from
 * `records` again rather than from a summary shown earlier.
 */
export function SummaryPanel({ records }: SummaryPanelProps): ReactElement {
  const [state, setState] = useState<SummaryState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const onAsk = async (): Promise<void> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "pending" });

    try {
      const response = await fetchDashboardSummary(
        records.map(toDashboardRecord),
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setState({ status: "done", summary: response.summary });
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        setState({ status: "error", error: caught });
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            void onAsk();
          }}
          disabled={state.status === "pending" || records.length === 0}
          className="w-full min-[720px]:w-auto"
        >
          Ask for a summary
        </Button>
        {state.status === "pending" ? (
          <LoadingIndicator label="Writing summary" />
        ) : null}
        {state.status === "error" ? (
          <Caption>{describeApiError(state.error, "The summary did not load")}</Caption>
        ) : null}
      </div>
      {state.status === "done" ? (
        <p className="max-w-[70ch] font-sans text-body-lg text-(color:--color-body)">
          {state.summary}
        </p>
      ) : null}
    </div>
  );
}
