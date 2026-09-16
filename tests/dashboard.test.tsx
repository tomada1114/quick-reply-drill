import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dashboard } from "../src/components/dashboard/dashboard";
import type { RecordStorage } from "../src/components/lib/records-store";
import type { DrillRecord } from "../src/core/records";
import { RECORDS_STORAGE_VERSION } from "../src/core/records";
import { ITEM_IDS, type ItemId, type Score } from "../src/core/rubric";
import { MAX_DASHBOARD_RECORDS } from "../src/core/wire";

/** An in-memory `Storage` stand-in, matching `tests/records-store.test.ts`'s. */
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

/** A fully populated, schema-valid record, distinguishable by `id`. */
function makeRecord(overrides: Partial<DrillRecord> = {}): DrillRecord {
  const scores = Object.fromEntries(ITEM_IDS.map((id) => [id, 4])) as Record<
    ItemId,
    Score
  >;
  const rationales = Object.fromEntries(
    ITEM_IDS.map((id) => [id, "Because it fits."]),
  ) as Record<ItemId, string>;

  return {
    id: "a",
    recordedAt: "2026-09-10T00:00:00.000Z",
    question: {
      text: "Are you free Friday afternoon?",
      scenarioLine: "Your coworker Maya asks over chat.",
      seed: {
        interlocutorId: "coworker",
        settingId: "office-chat",
        topicId: "scheduling",
      },
    },
    answer: "Yes, I am free on Friday afternoon.",
    forcedSubmit: false,
    elapsedMs: 12_000,
    scores,
    rationales,
    comments: {
      conversation: "Keeps the conversation moving.",
      accuracy: "No grammar issues.",
      vocabulary: "Natural word choice.",
      appropriateness: "Right register for a coworker.",
    },
    modelReply: "Yes, I'm free on Friday afternoon.",
    model: { alias: "gpt-5-mini", reasoningEffort: "low" },
    rubricVersion: "2026-09.2",
    ...overrides,
  };
}

/**
 * Writes `records` straight into the envelope `createRecordsStore` reads,
 * deliberately bypassing `append()` — this is what lets a case seed the
 * store in an order other than newest-first, proving the dashboard sorts by
 * `recordedAt` itself rather than trusting whatever order it was handed.
 */
function seed(storage: RecordStorage, records: DrillRecord[]): void {
  storage.setItem(
    "quick-reply-drill.records",
    JSON.stringify({ version: RECORDS_STORAGE_VERSION, records }),
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Dashboard", () => {
  it("shows a loading indicator while history is being read", async () => {
    render(<Dashboard storage={new MapStorage()} />);

    expect(screen.getByRole("status", { name: "Loading history" })).toBeInTheDocument();
    expect(await screen.findByText(/No reps yet\./)).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Loading history" }),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state with a link back to the drill", async () => {
    render(<Dashboard storage={new MapStorage()} />);

    expect(await screen.findByText(/No reps yet\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start one" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows the empty state when reading storage throws", async () => {
    const storage = new MapStorage();
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    render(<Dashboard storage={storage} />);

    expect(await screen.findByText(/No reps yet\./)).toBeInTheDocument();
  });

  it("lists the recent runs newest first, regardless of the order they were stored in", async () => {
    const storage = new MapStorage();
    // Stored oldest-first — the opposite of what the dashboard must display.
    seed(storage, [
      makeRecord({ id: "older", recordedAt: "2026-09-10T00:00:00.000Z" }),
      makeRecord({ id: "newer", recordedAt: "2026-09-11T00:00:00.000Z" }),
    ]);

    render(<Dashboard storage={storage} />);

    const rows = await screen.findAllByRole("row");
    // rows[0] is the header row.
    expect(rows[1]).toHaveTextContent("2026-09-11");
    expect(rows[2]).toHaveTextContent("2026-09-10");
  });

  it("hides the sparkline with a single record", async () => {
    const oneRecord = new MapStorage();
    seed(oneRecord, [makeRecord({ id: "a" })]);
    render(<Dashboard storage={oneRecord} />);
    await screen.findAllByRole("row");

    expect(
      screen.queryByRole("img", { name: "Total score trend" }),
    ).not.toBeInTheDocument();
  });

  it("shows the sparkline with three records", async () => {
    const threeRecords = new MapStorage();
    seed(threeRecords, [
      makeRecord({ id: "a", recordedAt: "2026-09-09T00:00:00.000Z" }),
      makeRecord({ id: "b", recordedAt: "2026-09-10T00:00:00.000Z" }),
      makeRecord({ id: "c", recordedAt: "2026-09-11T00:00:00.000Z" }),
    ]);

    render(<Dashboard storage={threeRecords} />);

    expect(
      await screen.findByRole("img", { name: "Total score trend" }),
    ).toBeInTheDocument();
  });

  it("splits records under a different rubricVersion into their own section", async () => {
    const storage = new MapStorage();
    seed(storage, [
      makeRecord({
        id: "old",
        recordedAt: "2026-09-01T00:00:00.000Z",
        rubricVersion: "2026-09.1",
      }),
      makeRecord({
        id: "new",
        recordedAt: "2026-09-10T00:00:00.000Z",
        rubricVersion: "2026-09.2",
      }),
    ]);

    render(<Dashboard storage={storage} />);

    expect(await screen.findByText("RUBRIC 2026-09.1")).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(2);
  });

  it("shows a loading indicator while the summary is being written", async () => {
    const storage = new MapStorage();
    seed(storage, [makeRecord({ id: "a" })]);
    let resolveSummary: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveSummary = resolve;
          }),
      ),
    );

    render(<Dashboard storage={storage} />);
    await screen.findAllByRole("row");
    fireEvent.click(screen.getByRole("button", { name: "Ask for a summary" }));

    expect(screen.getByRole("status", { name: "Writing summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask for a summary" })).toBeDisabled();

    resolveSummary?.(jsonResponse(200, { summary: "You're improving steadily." }));
    expect(await screen.findByText("You're improving steadily.")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Writing summary" }),
    ).not.toBeInTheDocument();
  });

  it("posts at most MAX_DASHBOARD_RECORDS records and renders the returned paragraph", async () => {
    const storage = new MapStorage();
    seed(
      storage,
      Array.from({ length: MAX_DASHBOARD_RECORDS + 3 }, (_unused, index) =>
        makeRecord({
          id: `r${String(index)}`,
          recordedAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        }),
      ),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { summary: "You're improving steadily." }));
    vi.stubGlobal("fetch", fetchMock);

    render(<Dashboard storage={storage} />);
    await screen.findAllByRole("row");
    fireEvent.click(screen.getByRole("button", { name: "Ask for a summary" }));

    expect(await screen.findByText("You're improving steadily.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, { body: string }];
    const sentBody: { records: unknown[] } = JSON.parse(options.body) as {
      records: unknown[];
    };
    expect(sentBody.records).toHaveLength(MAX_DASHBOARD_RECORDS);
  });

  it("shows the error pattern from #17 on a failed summary request", async () => {
    const storage = new MapStorage();
    seed(storage, [makeRecord({ id: "a" })]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(500, {
          error: {
            code: "ERR_LLM_TIMEOUT",
            message: "The model did not answer in time.",
          },
        }),
      ),
    );

    render(<Dashboard storage={storage} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ask for a summary" }));

    expect(
      await screen.findByText("The summary did not load (ERR_LLM_TIMEOUT). Try again."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Writing summary" }),
    ).not.toBeInTheDocument();
  });
});
