import type { Metadata } from "next";
import type { ReactElement } from "react";

import { Dashboard } from "@/components/dashboard/dashboard";

/**
 * The dashboard route: `<Dashboard />` renders the recent-runs table, the
 * sparkline, and the AI summary control, all read from the learner's own
 * `localStorage` history.
 *
 * @remarks
 * This stays a Server Component for the same reason `src/app/page.tsx` does
 * — `<Dashboard />` is the smallest file that actually needs `"use client"`
 * (state, an effect, `localStorage`), per `building-app-routes`.
 */
export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage(): ReactElement {
  return <Dashboard />;
}
