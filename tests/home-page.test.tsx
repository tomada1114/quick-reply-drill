import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "../src/app/page";
import type { QuestionsResponse } from "../src/core/wire";

// The home page, rendered the way `writing-tests`/`placing-tests` settle it:
// under jsdom, through Testing Library. `HomePage` itself carries no
// `"use client"` and stays a Server Component — it is synchronous, which is
// what `building-app-routes` says makes it renderable here at all — even
// though the `<Drill />` it now renders is a Client Component further down
// the tree; Testing Library executes that render the same way regardless of
// which side of the boundary a descendant sits on.
//
// The title and the one-line description this suite used to assert on the
// page's own placeholder markup now live solely in `src/app/layout.tsx`'s
// `metadata` export, untouched by issue #17 — the drill and feedback screens
// carry no page title of their own, so there is nothing to find in the
// rendered tree any more. What this suite checks instead is that the page
// mounts `<Drill />` and reaches its idle screen without ever touching a real
// network.

const ONE_QUESTION: QuestionsResponse = {
  questions: [
    {
      id: "q1",
      question: "Are you free Friday afternoon?",
      scenarioLine: "Your coworker Maya asks over chat.",
      seed: {
        interlocutorId: "coworker",
        settingId: "office-chat",
        topicId: "scheduling",
      },
    },
  ],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, ONE_QUESTION)));
  });

  it("renders under jsdom", () => {
    // Proves the `component` vitest project actually runs under jsdom, and
    // that `tests/**/*.test.ts` (the `unit`/`automation` projects) does not:
    // `tests/server-env.test.ts` and the rest of the `node`-environment suite
    // have no `document` to assert against.
    expect(typeof document).not.toBe("undefined");
  });

  it("reaches the drill's idle screen once the question queue is ready", async () => {
    render(<HomePage />);

    expect(await screen.findByRole("button", { name: "Start" })).toBeEnabled();
  });
});
