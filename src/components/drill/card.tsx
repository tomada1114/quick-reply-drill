import type { ReactElement, ReactNode } from "react";

import { cn } from "@/components/lib/utils";

interface DrillCardProps {
  readonly children: ReactNode;
  readonly className?: string;
  /**
   * Whether the countdown is inside its last ten seconds: thickens the card's
   * top rule to 2px and recolors it to status, per the countdown recipe.
   */
  readonly urgent?: boolean;
}

/**
 * The one card every drill, feedback and idle screen renders inside — the
 * `designing-ui` lock's "Card" recipe: white, an 8px radius, the one shadow
 * this system uses, 24px padding (16px below 720px). Below 720px it loses its
 * border, shadow and radius and becomes the page itself, except for the top
 * rule carrying the countdown's status signal, which stays visible at every
 * width because it is the one piece of state a colorblind or grayscale reader
 * still has to see.
 */
export function DrillCard({
  children,
  className,
  urgent = false,
}: DrillCardProps): ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 border-t bg-paper p-4 transition-colors",
        "min-[720px]:rounded-card min-[720px]:border-x min-[720px]:border-b min-[720px]:border-x-rule min-[720px]:border-b-rule min-[720px]:p-6 min-[720px]:shadow-card",
        urgent ? "border-t-2 border-t-status" : "border-t-rule",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The one separator this system uses between a card's zones. */
export function DrillDivider(): ReactElement {
  return <div className="border-t border-rule" />;
}
