import { TransactionsShell } from "@alter-ego/finance/components/transactions/transactions-shell"
import { Skeleton } from "@alter-ego/ui/ui/skeleton"
import { Suspense } from "react"


import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Transactions | Alter Ego",
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <TransactionsShell />
    </Suspense>
  )
}
