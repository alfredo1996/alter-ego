import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it } from "vitest"

import { GET as transactionsExportGet } from "@/app/api/v1/transactions/export/route"
import { __resetMockState, createMockAdapter } from "@/lib/backend/mock"
import { apiTransactionsExportSchema } from "@/types/schemas"

// ─── Schema validation ────────────────────────────────────────────────────────

describe("apiTransactionsExportSchema", () => {
  it("accepts valid ISO date strings + default expandSplits=false", () => {
    const result = apiTransactionsExportSchema.safeParse({
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dateFrom).toBeInstanceOf(Date)
      expect(result.data.dateTo).toBeInstanceOf(Date)
      expect(result.data.expandSplits).toBe(false)
    }
  })

  it("coerces 'true' string to expandSplits=true", () => {
    const result = apiTransactionsExportSchema.safeParse({
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      expandSplits: "true",
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.expandSplits).toBe(true)
  })

  it("rejects missing dateFrom", () => {
    const result = apiTransactionsExportSchema.safeParse({ dateTo: "2026-06-30" })
    expect(result.success).toBe(false)
  })

  it("rejects dateFrom > dateTo", () => {
    const result = apiTransactionsExportSchema.safeParse({
      dateFrom: "2026-07-01",
      dateTo: "2026-06-30",
    })
    expect(result.success).toBe(false)
  })
})


// ─── Route handler integration ────────────────────────────────────────────────

const USER_ID = "mock-user-1"
let apiKey: string

async function setupAuthed() {
  __resetMockState()
  const mock = createMockAdapter()
  await mock.auth.signIn("test@test.com", "password")
  const { key } = await mock.db.createApiKey(USER_ID)
  apiKey = key
  return mock
}

function makeRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers })
}

describe("GET /api/v1/transactions/export", () => {
  beforeEach(async () => {
    await setupAuthed()
  })

  it("rejects requests without an API key (401)", async () => {
    const res = await transactionsExportGet(
      makeRequest("http://localhost/api/v1/transactions/export?dateFrom=2026-06-01&dateTo=2026-06-30"),
    )
    expect(res.status).toBe(401)
  })

  it("rejects missing dateFrom (400)", async () => {
    const res = await transactionsExportGet(
      makeRequest("http://localhost/api/v1/transactions/export?dateTo=2026-06-30", {
        Authorization: `Bearer ${apiKey}`,
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })

  it("returns text/csv with Content-Disposition when authed", async () => {
    const mock = await setupAuthed()
    const account = await mock.db.createAccount(USER_ID, {
      name: "Checking",
      type: "checking",
      currency: "EUR",
      balance: 0,
    })
    await mock.db.createTransaction(USER_ID, {
      accountId: account.id,
      type: "expense",
      amount: 50,
      currency: "EUR",
      description: "Coffee",
      date: new Date("2026-06-15T12:00:00"),
      categoryId: null,
    })

    const res = await transactionsExportGet(
      makeRequest(
        "http://localhost/api/v1/transactions/export?dateFrom=2026-06-01&dateTo=2026-06-30",
        { Authorization: `Bearer ${apiKey}` },
      ),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/csv")
    expect(res.headers.get("content-disposition")).toContain(
      "transactions-2026-06-01_to_2026-06-30.csv",
    )
    const body = await res.text()
    expect(body).toContain("Date,Status,Type,Description,Amount,Currency,Account,Category,Notes")
    expect(body).toContain("Coffee")
  })

  it("uses the -expanded filename when expandSplits=true", async () => {
    const res = await transactionsExportGet(
      makeRequest(
        "http://localhost/api/v1/transactions/export?dateFrom=2026-06-01&dateTo=2026-06-30&expandSplits=true",
        { Authorization: `Bearer ${apiKey}` },
      ),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("content-disposition")).toContain(
      "transactions-2026-06-01_to_2026-06-30-expanded.csv",
    )
  })
})
