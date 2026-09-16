import Link from "next/link";
import type { ReactElement } from "react";

/**
 * The 404 boundary, rendered inside the root layout's document shell.
 *
 * @remarks
 * `next/link` directly, rather than a locale-aware wrapper: there is no locale
 * prefix for a link to lose now that the page tree is flat.
 */
export default function NotFound(): ReactElement {
  return (
    <main className="p-8">
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link href="/">Return to the home page</Link>
    </main>
  );
}
