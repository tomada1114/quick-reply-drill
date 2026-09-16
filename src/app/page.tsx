import type { ReactElement } from "react";

/**
 * The placeholder this repository serves until the drill screen exists.
 *
 * @remarks
 * It is deliberately the smallest page that proves the App Router tree is
 * wired: `tests/server-smoke.test.ts` serves the build and asks for it over
 * HTTP, which is the only check that sees a page at all.
 */
export default function HomePage(): ReactElement {
  return (
    <main>
      <h1>Quick Reply Drill</h1>
      <p>
        Answer a one-line English question in thirty seconds, and get it scored the same
        way every time.
      </p>
    </main>
  );
}
