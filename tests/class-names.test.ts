import { describe, expect, it } from "vitest";

import { cn } from "@/components/lib/utils";

describe("cn", () => {
  it.each([
    ["text-micro", "text-slate"],
    ["text-caption", "text-slate"],
    ["text-body", "text-ink"],
    ["text-body-lg", "text-fog"],
    ["text-question", "text-ink"],
    ["text-figure", "text-status"],
  ])("keeps the theme size %s beside the color %s", (size, color) => {
    expect(cn(size, color).split(" ")).toEqual([size, color]);
  });

  it("still lets a later theme size replace an earlier one", () => {
    expect(cn("text-caption", "text-body")).toBe("text-body");
  });

  it("still lets a later color replace an earlier one", () => {
    expect(cn("text-figure text-ink", "text-status")).toBe("text-figure text-status");
  });
});
