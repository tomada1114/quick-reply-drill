import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

import "./globals.css";

/**
 * The document shell every page and boundary renders inside.
 *
 * @remarks
 * This application ships one UI language, so `lang` is a literal rather than a
 * value read per request. There is no locale segment above it and no root
 * layout that does not know the language — those existed while `next-intl`
 * routed `/en` and `/ja`, and went with it.
 */
export const metadata: Metadata = {
  title: "Quick Reply Drill",
  description:
    "Answer a one-line English question in thirty seconds, and get it scored the same way every time.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <html lang="en">
      <body className="p-8">{children}</body>
    </html>
  );
}
