import { redirect } from "next/navigation"

import { BudgetsShell } from "@/components/budgets/budgets-shell"
import { features } from "@/lib/features"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Budgets — Alter Ego",
}

export default function BudgetsPage() {
  if (!features.budgets) redirect("/dashboard")
  return <BudgetsShell />
}
