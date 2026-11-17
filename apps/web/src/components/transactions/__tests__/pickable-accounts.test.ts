import { pickableAccounts } from "@alter-ego/finance/components/transactions/transaction-form-dialog"
import { describe, expect, it, vi } from "vitest"


import type { Account, Transaction } from "@/types"

// The dialog module pulls in the app's hooks; the helper under test needs none of them.
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null }) }))
vi.mock("@alter-ego/finance/hooks/use-merchant-normalization", () => ({ useMerchantNormalization: () => ({ normalize: (s: string) => s }) }))
vi.mock("@alter-ego/finance/hooks/use-transactions", () => ({ useDescriptionSuggestions: () => ({ data: [] }) }))

const now = new Date()
const account = (id: string, isArchived: boolean): Account => ({
  id, userId: "u1", name: id, type: "checking", currency: "EUR", balance: 0, openingBalance: 0,
  icon: null, color: null, isArchived, createdAt: now, updatedAt: now,
})
const bank = account("bank", false)
const closed = account("closed", true)
const other = account("other", true)

describe("pickableAccounts", () => {
  it("offers open accounts only when adding", () => {
    expect(pickableAccounts([bank, closed, other]).map((a) => a.id)).toEqual(["bank"])
  })

  it("keeps the archived accounts a transaction being edited sits on, both legs of a transfer", () => {
    const transfer = { accountId: "closed", transferToAccountId: "other" } as Transaction
    expect(pickableAccounts([bank, closed, other], transfer).map((a) => a.id)).toEqual(["bank", "closed", "other"])
    const expense = { accountId: "closed", transferToAccountId: null } as Transaction
    expect(pickableAccounts([bank, closed, other], expense).map((a) => a.id)).toEqual(["bank", "closed"])
  })
})
