import { RecurringShell } from "@alter-ego/finance/components/recurring/recurring-shell"
import { features } from "@alter-ego/finance/lib/features"
import { PageLoader } from "@alter-ego/ui/page/page-state"
import { redirect } from "next/navigation"
import { Suspense } from "react"


import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recurring Transactions — Alter Ego",
}

export default function RecurringPage() {
  if (!features.recurring) redirect("/dashboard")
  // useSearchParams (Reports' ?tab=suggested link) needs a Suspense boundary to prerender.
  return (
    <Suspense fallback={<PageLoader />}>
      <RecurringShell />
    </Suspense>
  )
}
