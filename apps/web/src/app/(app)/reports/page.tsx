import { ReportsShell } from "@alter-ego/finance/components/reports/reports-shell"
import { Skeleton } from "@alter-ego/ui/ui/skeleton"
import { Suspense } from "react"


import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reports — Alter Ego",
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      <ReportsShell />
    </Suspense>
  )
}
