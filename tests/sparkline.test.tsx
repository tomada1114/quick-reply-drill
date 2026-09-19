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
    comments: {
      conversation: "",
      accuracy: "",
      vocabulary: "",
      appropriateness: "",
    },
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
    // The stroked line is the second path: the first closes the same shape
    // down to the baseline to carry the area fill.
    const paths = svg.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    // One "move to" or "line to" command per record, plus the two baseline
    // corners the filled path adds.
    expect(paths[0]?.getAttribute("d")?.match(/[ML]/g)).toHaveLength(5);
    expect(paths[1]?.getAttribute("d")?.match(/[ML]/g)).toHaveLength(3);

    // viewBox is 480x110: an 8px left inset, a 30px right gutter for the
    // gridline labels, and 10px above and below. The total is scaled against
    // a fixed 0-100 domain, so the third (newest, total 100) point sits at
    // the right edge of the plot, at the very top.
    const dot = svg.querySelector("circle");
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("cx")).toBe("450");
    expect(dot?.getAttribute("cy")).toBe("10");
    expect(dot?.getAttribute("r")).toBe("4.5");
  });

  it("marks 50 and 100 with a labelled gridline", () => {
    render(
      <Sparkline
        records={[
          makeRecord("b", "2026-09-11T00:00:00.000Z", 4),
          makeRecord("a", "2026-09-10T00:00:00.000Z", 3),
        ]}
      />,
    );

    const svg = screen.getByRole("img", { name: "Total score trend" });
    expect(svg.querySelectorAll("line")).toHaveLength(2);
    // The readings are HTML beside the drawing, not text inside it: text in a
    // drawing that scales with the card would never be the token size.
    expect(svg.querySelectorAll("text")).toHaveLength(0);
    const readings = svg.parentElement?.querySelectorAll("span");
    expect([...(readings ?? [])].map((node) => node.textContent)).toEqual([
      "50",
      "100",
    ]);
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
