import { BudgetsPage } from "@alter-ego/finance/pages/budgets-page"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Budgets — Alter Ego",
}

export default function Route() {
  return <BudgetsPage />
}
