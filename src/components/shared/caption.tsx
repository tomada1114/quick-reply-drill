import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/components/lib/utils";

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
    <p className={cn("mb-0 font-sans text-caption text-slate", className)} {...props} />
  );
}
