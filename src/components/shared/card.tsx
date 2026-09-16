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

/** The separator shared by the drill and dashboard screens. */
export function DrillDivider(): ReactElement {
  return <div className="border-t border-rule" />;
}
