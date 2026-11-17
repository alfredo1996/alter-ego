import { DashboardPage } from "@alter-ego/finance/pages/dashboard-page"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard | Alter Ego",
}

export default function Route() {
  return <DashboardPage />
}
