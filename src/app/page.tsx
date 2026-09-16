import type { ReactElement } from "react";

import { Drill } from "@/components/drill/drill";

/**
 * The drill page: the loop `<Drill />` renders,
 * `idle → answering → scoring → feedback`.
 *
 * @remarks
 * This stays a Server Component — `<Drill />` is the smallest file that
 * actually needs `"use client"` (state, a countdown, `localStorage`), per
 * `building-app-routes`. The title and the one-line description that used to
 * render here now live solely in `src/app/layout.tsx`'s `metadata` export;
 * the drill and feedback screens the lock describes carry no page title of
 * their own — "Nothing else is on the screen" — so nothing here restates it.
 */
export default function HomePage(): ReactElement {
  return <Drill />;
}
