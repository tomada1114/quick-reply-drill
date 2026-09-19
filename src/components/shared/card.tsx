import type { ReactElement, ReactNode } from "react";

import { cn } from "@/components/lib/utils";

interface DrillCardProps {
  readonly children: ReactNode;
  readonly className?: string;
  /** Whether the countdown is inside its last ten seconds. */
  readonly urgent?: boolean;
}

/** The card recipe shared by the drill and dashboard screens. */
export function DrillCard({
  children,
  className,
  urgent = false,
}: DrillCardProps): ReactElement {
  return (
    <div
      className={cn(
        // Depth is paper-on-ground plus a 1px ring, never a shadow — and
        // below 720px not even the ring: there the card *is* the page. The
        // urgent state's 3px status bar is an inset shadow rather than a
        // border so it survives both, and so the card's own box does not
        // grow by 3px the moment the countdown turns red.
        "flex flex-col gap-6 bg-paper p-4 transition-shadow",
        "min-[720px]:rounded-card min-[720px]:p-6",
        // The two states carry their whole `box-shadow` each, rather than the
        // urgent one being layered over `shadow-card`: two shadow utilities on
        // one element are decided by the order Tailwind emitted them, not by
        // which was written last, and `shadow-card` won that race.
        urgent
          ? "shadow-[inset_0_3px_0_var(--color-status)] min-[720px]:shadow-[0_0_0_1px_var(--color-rule),inset_0_3px_0_var(--color-status)]"
          : "min-[720px]:shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The separator shared by the drill and dashboard screens. */
export function DrillDivider(): ReactElement {
  return <div className="border-t border-rule" />;
}
