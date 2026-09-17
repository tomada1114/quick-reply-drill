import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Caption } from "@/components/shared/caption";

// Issue #57: `globals.css`'s base `<p>` bottom margin pushed a caption beside
// a button off-centre, patched per site with `mb-0` three times. `Caption` is
// the one place `text-caption text-slate` may still appear in `src/`, so what
// matters here is that it carries `mb-0` by default rather than leaving each
// call site to remember it, and that a caller's own `className` still wins.

describe("Caption", () => {
  it("renders the caption classes with the base paragraph margin zeroed", () => {
    render(<Caption>A coworker asks over chat.</Caption>);

    const caption = screen.getByText("A coworker asks over chat.");
    expect(caption.tagName).toBe("P");
    expect(caption.className).toContain("mb-0");
    expect(caption.className).toContain("font-sans");
    expect(caption.className).toContain("text-caption");
    expect(caption.className).toContain("text-slate");
  });

  it("forwards ordinary paragraph props such as id", () => {
    render(
      <Caption id="answering-shortcut-hint">Reply in one or two sentences.</Caption>,
    );

    expect(screen.getByText("Reply in one or two sentences.")).toHaveAttribute(
      "id",
      "answering-shortcut-hint",
    );
  });

  it("lets a caller's className override the zeroed margin", () => {
    render(<Caption className="mb-4">Kept for spacing.</Caption>);

    const caption = screen.getByText("Kept for spacing.");
    expect(caption.className).toContain("mb-4");
    expect(caption.className).not.toContain("mb-0");
  });
});
