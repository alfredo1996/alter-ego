import { use } from "react"

import { AccountDetailShell } from "@/components/accounts/account-detail-shell"

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
