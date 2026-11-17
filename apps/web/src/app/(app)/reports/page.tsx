import { ReportsPage } from "@alter-ego/finance/pages/reports-page"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reports — Alter Ego",
}

export default function Route() {
  return <ReportsPage />
}
