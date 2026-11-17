
import { BudgetsShell } from "@alter-ego/finance/components/budgets/budgets-shell"
import { features } from "@alter-ego/finance/lib/features"
import { redirect } from "next/navigation"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Budgets — Alter Ego",
}

export default function BudgetsPage() {
  if (!features.budgets) redirect("/dashboard")
  return <BudgetsShell />
}
