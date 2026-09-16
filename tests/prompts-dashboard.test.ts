import { describe, expect, it } from "vitest";

import type { LlmRequest } from "../src/ai/index";
import { CRITERIA, ITEM_IDS } from "../src/core/rubric";
import type { DashboardRecord } from "../src/core/wire";
import {
  buildDashboardRequest,
  dashboardOutputSchema,
} from "../src/server/prompts/dashboard";

/** One record, for a case to vary a single field of. */
function record(overrides: Partial<DashboardRecord> = {}): DashboardRecord {
  return {
    recordedAt: "2026-09-01T00:00:00.000Z",
    question: {
      text: "Are you free for lunch tomorrow?",
      scenarioLine: "A coworker, in a direct message",
    },
    answer: "Sure, tomorrow works. Where do you want to go?",
    scores: Object.fromEntries(
      ITEM_IDS.map((id) => [id, 4]),
    ) as DashboardRecord["scores"],
    comments: Object.fromEntries(
      CRITERIA.map((criterion) => [criterion.id, "Change this."]),
    ) as DashboardRecord["comments"],
    rubricVersion: "2026-09.1",
    ...overrides,
  };
}

describe("buildDashboardRequest", () => {
  it("returns the LlmRequest fields a caller adds only a signal to", () => {
    // The annotation is the assertion: a prompt module states its return type
    // structurally rather than importing the AI layer, so this is where the
    // two shapes are held together.
    const asRequest: Omit<
      LlmRequest<typeof dashboardOutputSchema>,
      "signal"
    > = buildDashboardRequest([record()]);

    expect(asRequest.schema).toBe(dashboardOutputSchema);
    expect(asRequest.outputLanguage).toBe("en");
  });

  it("puts every record's reply in the prompt", () => {
    const first = record({ answer: "Sure, tomorrow works." });
    const second = record({
      recordedAt: "2026-09-02T00:00:00.000Z",
      answer: "I will send it tomorrow morning.",
    });

    const request = buildDashboardRequest([first, second]);

    expect(request.prompt).toContain(first.answer);
    expect(request.prompt).toContain(second.answer);
  });

  it("orders the records newest first regardless of the order they arrived in", () => {
    const older = record({
      recordedAt: "2026-09-01T00:00:00.000Z",
      answer: "Older reply.",
    });
    const newer = record({
      recordedAt: "2026-09-05T00:00:00.000Z",
      answer: "Newer reply.",
    });

    const request = buildDashboardRequest([older, newer]);

    expect(request.prompt.indexOf(newer.answer)).toBeLessThan(
      request.prompt.indexOf(older.answer),
    );
  });

  it("names the scenario, question, scores and comments for each record", () => {
    const request = buildDashboardRequest([record()]);

    expect(request.prompt).toContain("A coworker, in a direct message");
    expect(request.prompt).toContain("Are you free for lunch tomorrow?");
    for (const id of ITEM_IDS) {
      expect(request.prompt).toContain(`${id}: 4`);
    }
    for (const criterion of CRITERIA) {
      expect(request.prompt).toContain(`${criterion.id}: Change this.`);
    }
  });

  it("asks for one paragraph of 120 to 200 words across the four criteria", () => {
    const request = buildDashboardRequest([record()]);

    expect(request.instructions).toContain("120 to 200 words");
    for (const criterion of CRITERIA) {
      expect(request.instructions).toContain(criterion.id);
    }
  });

  it("forbids a list, a heading or restating a score", () => {
    const request = buildDashboardRequest([record()]);

    expect(request.instructions).toContain("no list, no heading");
    expect(request.instructions).toContain("Do not restate any score");
  });

  it("keeps the instructions identical while the prompt varies with the records", () => {
    const one = buildDashboardRequest([record()]);
    const other = buildDashboardRequest([record({ answer: "A different reply." })]);

    expect(other.instructions).toBe(one.instructions);
    expect(other.prompt).not.toBe(one.prompt);
  });
});

describe("dashboardOutputSchema", () => {
  it("asks for a single summary field", () => {
    expect(Object.keys(dashboardOutputSchema.shape)).toStrictEqual(["summary"]);
  });

  it("parses an answer carrying a summary and rejects one without it", () => {
    expect(dashboardOutputSchema.safeParse({ summary: "A paragraph." }).success).toBe(
      true,
    );
    expect(dashboardOutputSchema.safeParse({}).success).toBe(false);
  });
});
