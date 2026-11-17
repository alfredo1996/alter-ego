import { AccountDetailPage } from "@alter-ego/finance/pages/account-detail-page"
import { use } from "react"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Account | Alter Ego" }

export default function Route({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <AccountDetailPage accountId={id} />
}
