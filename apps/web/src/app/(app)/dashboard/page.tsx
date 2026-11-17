import { DashboardShell } from "@alter-ego/finance/components/dashboard/dashboard-shell"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard | Alter Ego",
}

export default function DashboardPage() {
  return <DashboardShell />
}
