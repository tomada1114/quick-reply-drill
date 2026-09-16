import type { ReactElement } from "react";

interface LoadingIndicatorProps {
  /** The short status announced while the surrounding request is in flight. */
  readonly label: string;
}

/** The shared, monochrome wait state for requests that keep a screen in place. */
export function LoadingIndicator({ label }: LoadingIndicatorProps): ReactElement {
  return (
    <div
      aria-label={label}
      aria-live="polite"
      className="inline-flex font-sans text-caption text-slate"
      role="status"
    >
      <span>
        {label}
        <span
          aria-hidden="true"
          className="font-mono text-caption motion-safe:animate-pulse"
        >
          …
        </span>
      </span>
    </div>
  );
}
