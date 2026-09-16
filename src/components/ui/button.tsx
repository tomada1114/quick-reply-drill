import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/components/lib/utils";

// Copied from the shadcn/ui registry (`pnpm dlx shadcn@latest add button`) and
// restyled to the "Primary action" recipe in
// `.agents/skills/designing-ui/references/tokens.md` (issue #14): one filled
// action per screen. The registry's `destructive`/`outline`/`secondary`/
// `ghost`/`link` variants and every size but the default are dropped rather
// than restyled, because none of them has a recipe in the lock — keeping them
// would mean leaving them pointing at shadcn's own `bg-primary`/`bg-accent`/
// `ring-ring` tokens, which this theme never defines. The component still
// carries the explicit return type this repository's ESLint config requires.
//
// The label's type is set with three separate arbitrary utilities rather than
// the `text-body` size utility: `--color-body` also names a color, and
// Tailwind resolves a bare `text-{name}` as that color whenever one exists
// with the same name, before it ever considers `--text-{name}` a font size.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control bg-action px-6 py-2.5 font-sans text-[length:var(--text-body)] leading-[var(--text-body--line-height)] tracking-[var(--text-body--letter-spacing)] font-medium text-paper outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-inset disabled:text-fog [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);

interface ButtonProps extends ComponentProps<"button"> {
  asChild?: boolean;
}

function Button({ className, asChild = false, ...props }: ButtonProps): ReactElement {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp data-slot="button" className={cn(buttonVariants(), className)} {...props} />
  );
}

export { Button, buttonVariants };
