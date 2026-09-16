import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "../src/app/page";

// The home page, rendered the way `writing-tests`/`placing-tests` settle it:
// under jsdom, through Testing Library. The page carries no `"use client"` —
// `building-app-routes` explains why that is not what makes it renderable here
// — what does is that it is synchronous. An asynchronous Server Component is
// explicitly out of scope; this test never renders one.

describe("HomePage", () => {
  it("renders under jsdom", () => {
    // Proves the `component` vitest project actually runs under jsdom, and
    // that `tests/**/*.test.ts` (the `unit`/`automation` projects) does not:
    // `tests/server-env.test.ts` and the rest of the `node`-environment suite
    // have no `document` to assert against.
    expect(typeof document).not.toBe("undefined");
  });

  it("renders the title and the one-line description", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "Quick Reply Drill" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/thirty seconds/u)).toBeInTheDocument();
  });
});
