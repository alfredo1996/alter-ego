import { AccountDetailShell } from "@alter-ego/finance/components/accounts/account-detail-shell"
import { use } from "react"


import type { Metadata } from "next"

export const metadata: Metadata = { title: "Account | Alter Ego" }

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <AccountDetailShell accountId={id} />
}
