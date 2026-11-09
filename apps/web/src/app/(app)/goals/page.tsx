import { redirect } from "next/navigation"

import { SavingsGoalsShell } from "@/components/savings-goals/savings-goals-shell"
import { features } from "@/lib/features"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Goals | Alter Ego",
}

export default function GoalsPage() {
  if (!features.savingsGoals) redirect("/dashboard")
  return <SavingsGoalsShell />
}
