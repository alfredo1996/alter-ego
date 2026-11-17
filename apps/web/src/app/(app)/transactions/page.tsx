import { TransactionsPage } from "@alter-ego/finance/pages/transactions-page"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Transactions | Alter Ego",
}

export default function Route() {
  return <TransactionsPage />
}
