import { GoalsPage } from "@alter-ego/finance/pages/goals-page"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Goals | Alter Ego",
}

export default function Route() {
  return <GoalsPage />
}
