
import { SavingsGoalsShell } from "@alter-ego/finance/components/savings-goals/savings-goals-shell"
import { features } from "@alter-ego/finance/lib/features"
import { redirect } from "next/navigation"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Goals | Alter Ego",
}

export default function GoalsPage() {
  if (!features.savingsGoals) redirect("/dashboard")
  return <SavingsGoalsShell />
}
