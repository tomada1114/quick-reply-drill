import { IBM_Plex_Mono, Rubik } from "next/font/google";
import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

import "./globals.css";

/**
 * Rubik carries prose, labels, and buttons — everything but a figure.
 *
 * @remarks
 * `variable` is what exposes the loaded font as `--font-rubik` on `<html>`,
 * which `--font-sans` in `globals.css`'s `@theme` block resolves against;
 * `designing-ui`'s tokens lock the weights (400, 500), the subset, and
 * `display: "swap"`.
 */
const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-rubik",
});

/**
 * IBM Plex Mono carries the question, the countdown, and every figure.
 *
 * @remarks
 * Exposed as `--font-plex-mono`, which `--font-mono` resolves against. See
 * {@link rubik} for why the options are pinned rather than left at a default.
 */
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

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
    "Answer a one-line English question in sixty seconds, and get it scored the same way every time.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <html lang="en" className={`${rubik.variable} ${ibmPlexMono.variable}`}>
      <body className="p-4 min-[720px]:p-8">{children}</body>
    </html>
  );
}
