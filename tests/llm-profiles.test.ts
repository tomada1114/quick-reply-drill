import { describe, expect, it } from "vitest";

import { LLM_PROFILES, type LlmUse } from "../src/server/llm-profiles";

// Every use a model call in this application is made for. Written out by hand
// so a member added to `LlmUse` without a profile fails the coverage case
// below rather than being read off the table it is meant to check.
const USES = ["questions", "scoring", "dashboard"] as const satisfies readonly LlmUse[];

describe("the model profile each use is answered with", () => {
  it("gives every use a profile, and names no use that does not exist", () => {
    expect(Object.keys(LLM_PROFILES).sort()).toStrictEqual([...USES].sort());
  });

  // The values themselves, not merely their shape. A model or a reasoning
  // effort is a product decision about what an answer costs and how good it
  // is, so changing one has to change this test too — which is what puts the
  // decision in a reviewed diff rather than in a quiet edit.
  it("answers every use with the decided model and reasoning effort", () => {
    expect(LLM_PROFILES).toStrictEqual({
      questions: { model: "gpt-5.6-luna", reasoningEffort: "none" },
      scoring: { model: "gpt-5.6-luna", reasoningEffort: "high" },
      dashboard: { model: "gpt-5.6-luna", reasoningEffort: "high" },
    });
  });

  it.each(USES)("gives %s a non-empty model id", (use) => {
    expect(LLM_PROFILES[use].model).not.toBe("");
  });
});
