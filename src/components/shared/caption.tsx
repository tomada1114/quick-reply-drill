import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/components/lib/utils";

/**
 * The caption text recipe: `font-sans text-caption text-slate`. Kept out of
 * `cn`'s `tailwind-merge` pass on purpose — `tailwind-merge`'s default config
 * does not know this project's `--text-*` (size) and `--color-*` (color)
 * `@theme` tokens apart, so it buckets any two bare `text-{word}` utilities
 * it does not recognize into the same "text color" conflict group and drops
 * one. Passing `text-caption` and `text-slate` through `cn` together (or
 * `tailwind-merge` directly) silently drops `text-caption`; the same happens
 * today wherever `cn` combines a custom size token with a custom color token,
 * e.g. `text-figure` beside `text-slate`/`text-ink`/`text-status` in
 * `answering-card.tsx`'s countdown.
 */
const CAPTION_TEXT_CLASS_NAME = "font-sans text-caption text-slate";

/**
 * The base `<p>` bottom margin (`globals.css`'s `@layer base`) zeroed by
 * default. A hand-written `<p className="font-sans text-caption text-slate">`
 * picks up that margin silently, which only shows up as a bug beside a button
 * in a flex row (issue #57); render every caption through this component
 * instead so a new one cannot inherit the margin without an explicit
 * `className` opt-in — a caller's own margin utility still wins over `mb-0`
 * through `cn`, for the rare caption that relies on it for spacing.
 */
export function Caption({ className, ...props }: ComponentProps<"p">): ReactElement {
  return (
    <p className={`${CAPTION_TEXT_CLASS_NAME} ${cn("mb-0", className)}`} {...props} />
  );
}
