import { RecurringPage } from "@alter-ego/finance/pages/recurring-page"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recurring Transactions — Alter Ego",
}

export default function Route() {
  return <RecurringPage />
}
