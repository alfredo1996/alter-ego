import { createFinanceAdmin } from "@alter-ego/finance/adapter-admin"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_BACKEND: "firebase" } }))

// What getServerDb() exposed before the finance half moved into the package.
const FINANCE = [
  "getAccounts", "getAccount", "getBudgets", "getTags", "getRecurringTransactions", "getLastActivity",
  "getTransactions", "getTransaction", "createTransaction", "updateTransaction", "deleteTransaction",
  "getMonthlyTotals", "createAccount", "updateAccount", "getCategories", "getReportData",
]
const SHELL = ["createApiKey", "deleteApiKey", "validateApiKey", "addAuditEntry"]

describe("the server db", () => {
  it("the package's admin slice is exactly the finance functions", () => {
    expect(Object.keys(createFinanceAdmin(() => { throw new Error("never read at creation") })).sort()).toEqual([...FINANCE].sort())
  })

  it("is the shell plus the finance slice, with every method it had before", async () => {
    const { getServerDb } = await import("../server-db")
    expect(Object.keys(getServerDb()).sort()).toEqual([...FINANCE, ...SHELL].sort())
  })
})
