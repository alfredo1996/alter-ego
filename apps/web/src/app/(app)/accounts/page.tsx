import { AccountsShell } from "@/components/accounts/accounts-shell"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Accounts | Alter Ego",
}

export default function AccountsPage() {
  return <AccountsShell />
}
