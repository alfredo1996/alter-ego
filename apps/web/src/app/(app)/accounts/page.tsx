import { AccountsPage } from "@alter-ego/finance/pages/accounts-page"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Accounts | Alter Ego",
}

export default function Route() {
  return <AccountsPage />
}
