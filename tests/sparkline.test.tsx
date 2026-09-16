import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Sparkline } from "../src/components/dashboard/sparkline";
import type { DrillRecord } from "../src/core/records";
import { ITEM_IDS, type ItemId, type Score } from "../src/core/rubric";

/** A record whose every item is scored `level` (0-5), so `totalScore` is `20 * level`. */
function makeRecord(id: string, recordedAt: string, level: Score): DrillRecord {
  const scores = Object.fromEntries(
    ITEM_IDS.map((itemId) => [itemId, level]),
  ) as Record<ItemId, Score>;
  const rationales = Object.fromEntries(
    ITEM_IDS.map((itemId) => [itemId, "Because."]),
  ) as Record<ItemId, string>;

  return {
    id,
    recordedAt,
    question: {
      text: "Are you free Friday afternoon?",
      scenarioLine: "A coworker asks over chat.",
      seed: {
        interlocutorId: "coworker",
        settingId: "office-chat",
        topicId: "scheduling",
      },
    },
    answer: "Yes.",
    forcedSubmit: false,
    elapsedMs: 1000,
    scores,
    rationales,
    comments: { clarity: "", accuracy: "", vocabulary: "", appropriateness: "" },
    modelReply: "Yes.",
    model: { alias: "gpt-5-mini", reasoningEffort: "low" },
    rubricVersion: "2026-09.2",
  };
}

describe("Sparkline", () => {
  it("renders nothing for a single record", () => {
    const { container } = render(
      <Sparkline records={[makeRecord("a", "2026-09-10T00:00:00.000Z", 5)]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("draws one point per record, oldest to newest, with the dot on the last", () => {
    // Passed newest-first, matching every other list in this application.
    render(
      <Sparkline
        records={[
          makeRecord("c", "2026-09-12T00:00:00.000Z", 5), // total 100, newest
          makeRecord("b", "2026-09-11T00:00:00.000Z", 3), // total 60
          makeRecord("a", "2026-09-10T00:00:00.000Z", 1), // total 20, oldest
        ]}
      />,
    );

    const svg = screen.getByRole("img", { name: "Total score trend" });
    const path = svg.querySelector("path");
    expect(path).not.toBeNull();
    // One "move to" or "line to" command per record.
    expect(path?.getAttribute("d")?.match(/[ML]/g)).toHaveLength(3);

    // viewBox is 240x40 with a 4px inset on every side, and the total is
    // scaled against a fixed 0-100 domain: the third (newest, total 100)
    // point sits at the right edge, at the very top.
    const dot = svg.querySelector("circle");
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("cx")).toBe("236");
    expect(dot?.getAttribute("cy")).toBe("4");
    expect(dot?.getAttribute("r")).toBe("3");
  });

  it("shows nothing below two records and something at exactly two", () => {
    const { rerender, container } = render(
      <Sparkline records={[makeRecord("a", "2026-09-10T00:00:00.000Z", 3)]} />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <Sparkline
        records={[
          makeRecord("b", "2026-09-11T00:00:00.000Z", 4),
          makeRecord("a", "2026-09-10T00:00:00.000Z", 3),
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "Total score trend" })).toBeInTheDocument();
  });
});
