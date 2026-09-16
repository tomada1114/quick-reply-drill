import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// The first two components copied in from the shadcn/ui registry, and the `cn`
// they all call. What is asserted here is the wiring rather than the styling:
// that the `@/` alias resolves under Vitest as well as under `tsc` and the
// Next.js build (this file imports through it on purpose), and that a caller's
// own `className` wins over the component's default, which is the one
// behaviour of `cn` a component's appearance actually depends on. How these
// look is `designing-ui`'s subject and issue #14's work — no class list is
// pinned here, because a test that restated one would fail on every legitimate
// restyle.

describe("cn", () => {
  it("lets the later of two conflicting Tailwind utilities win", () => {
    expect(cn("p-2", "p-8")).toBe("p-8");
  });

  it("keeps utilities that do not conflict, and drops falsy input", () => {
    expect(cn("flex", false, undefined, "p-8")).toBe("flex p-8");
  });
});

describe("Button", () => {
  it("renders a button carrying its variant and size as data attributes", () => {
    render(<Button variant="outline" size="sm" />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-slot", "button");
    expect(button).toHaveAttribute("data-variant", "outline");
    expect(button).toHaveAttribute("data-size", "sm");
  });

  it("renders the child element instead of a button when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/">Return to the home page</a>
      </Button>,
    );

    expect(
      screen.getByRole("link", { name: "Return to the home page" }),
    ).toHaveAttribute("data-slot", "button");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lets a caller's className override the variant's own", () => {
    render(<Button className="p-8" />);

    expect(screen.getByRole("button").className).toContain("p-8");
    expect(screen.getByRole("button").className).not.toContain("py-2");
  });
});

describe("Textarea", () => {
  it("renders a textarea that forwards its props", () => {
    render(<Textarea placeholder="Your reply" rows={4} />);

    const textarea = screen.getByPlaceholderText("Your reply");
    expect(textarea).toHaveAttribute("data-slot", "textarea");
    expect(textarea).toHaveAttribute("rows", "4");
  });
});
