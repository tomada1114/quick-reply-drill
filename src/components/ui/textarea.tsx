import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/components/lib/utils";

// Copied from the shadcn/ui registry; restyled to the "Textarea" recipe in
// `.agents/skills/designing-ui/references/tokens.md` (issue #14). The
// registry's `aria-invalid:border-destructive` is dropped along with it: this
// design has no error color, and a validation failure is body copy under the
// field plus the border darkening to ink instead (see the recipe). `--color-body`
// is read through the `text-(color:--color-body)` arbitrary-variable syntax
// rather than the `text-body` utility, because `--text-body` is also a
// registered font-size token and `text-body` would resolve to that instead.
function Textarea({ className, ...props }: ComponentProps<"textarea">): ReactElement {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-control border border-rule bg-inset px-3.5 py-3 font-sans text-body-lg text-(color:--color-body) outline-none transition-colors placeholder:text-fog focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-inset disabled:text-fog",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
