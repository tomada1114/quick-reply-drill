import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `tailwind-merge` taught this theme's `--text-*` font-size tokens.
 *
 * @remarks
 * Its default config does not know them, so it files `text-figure` in the
 * same group as a color such as `text-ink` and drops whichever came first —
 * the size, in every caption and countdown written `size color`. Keep this
 * list in step with the `--text-*` tokens in `src/app/globals.css`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["micro", "caption", "body", "body-lg", "question", "figure"],
    },
  },
});

/**
 * Join class names and let the last Tailwind utility of a group win.
 *
 * @remarks
 * Every shadcn/ui component copied into `src/components/ui/` calls this, which
 * is why it sits at the path `components.json`'s `aliases.utils` names. `clsx`
 * resolves the conditional forms (an array, an object, a falsy value) into one
 * string; `twMerge` then drops the earlier of two utilities that set the same
 * property, so a `className` passed by a caller overrides the component's own
 * default instead of racing it in the stylesheet.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
