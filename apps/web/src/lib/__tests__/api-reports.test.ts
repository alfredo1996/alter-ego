import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it } from "vitest"

import { GET as reportsGet } from "@/app/api/v1/reports/route"
import { __resetMockState, createMockAdapter } from "@/lib/backend/mock"
import { apiReportsQuerySchema } from "@/types/schemas"

// ─── Schema validation ────────────────────────────────────────────────────────

describe("apiReportsQuerySchema", () => {
  it("accepts a period shortcut alone", () => {
    const r = apiReportsQuerySchema.safeParse({ period: "this-month" })
    expect(r.success).toBe(true)
  })

  it("accepts dateFrom + dateTo", () => {
    const r = apiReportsQuerySchema.safeParse({
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
    })
    expect(r.success).toBe(true)
  })

  it("rejects when neither period nor a range is provided", () => {
    const r = apiReportsQuerySchema.safeParse({})
    expect(r.success).toBe(false)
  })

  it("rejects dateFrom > dateTo", () => {
    const r = apiReportsQuerySchema.safeParse({
      dateFrom: "2026-07-01",
      dateTo: "2026-06-30",
    })
    expect(r.success).toBe(false)
  })

  it("splits accountIds CSV into an array", () => {
    const r = apiReportsQuerySchema.safeParse({
      period: "this-month",
      accountIds: "a,b,c",
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.accountIds).toEqual(["a", "b", "c"])
  })

  it("rejects an unknown period shortcut", () => {
    const r = apiReportsQuerySchema.safeParse({ period: "decade" })
    expect(r.success).toBe(false)
  })
})

// ─── Route handler integration ────────────────────────────────────────────────

const USER_ID = "mock-user-1"
let apiKey: string

async function setup() {
  __resetMockState()
  const mock = createMockAdapter()
  await mock.auth.signIn("test@test.com", "password")
  const { key } = await mock.db.createApiKey(USER_ID)
  apiKey = key
  return mock
}

function req(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers })
}

describe("GET /api/v1/reports", () => {
  beforeEach(async () => {
    await setup()
  })

  it("returns 401 without an API key", async () => {
    const res = await reportsGet(req("http://localhost/api/v1/reports?period=this-month"))
    expect(res.status).toBe(401)
  })

  it("returns 400 when no period and no range is given", async () => {
    const res = await reportsGet(
      req("http://localhost/api/v1/reports", { Authorization: `Bearer ${apiKey}` }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })

  it("returns 200 with the expected aggregate shape for a known period", async () => {
    const mock = await setup()
    const acc = await mock.db.createAccount(USER_ID, {
      name: "Checking",
      type: "checking",
      currency: "EUR",
      balance: 0,
    })
    await mock.db.createTransaction(USER_ID, {
      accountId: acc.id,
      type: "income",
      amount: 1000,
      currency: "EUR",
      description: "Salary",
      date: new Date(),
      categoryId: null,
    })
    await mock.db.createTransaction(USER_ID, {
      accountId: acc.id,
      type: "expense",
      amount: 250,
      currency: "EUR",
      description: "Rent",
      date: new Date(),
      categoryId: null,
    })

    const res = await reportsGet(
      req("http://localhost/api/v1/reports?period=this-month", {
        Authorization: `Bearer ${apiKey}`,
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      dateRange: { from: string; to: string }
      totalIncome: number
      totalExpenses: number
      netSavings: number
      categorySpending: unknown[]
      monthlySummary: unknown[]
      topExpenses: unknown[]
    }
    expect(body.totalIncome).toBe(1000)
    expect(body.totalExpenses).toBe(250)
    expect(body.netSavings).toBe(750)
    expect(body.dateRange.from).toBeTruthy()
    expect(body.dateRange.to).toBeTruthy()
    expect(Array.isArray(body.topExpenses)).toBe(true)
  })

  it("accepts explicit dateFrom + dateTo", async () => {
    const res = await reportsGet(
      req(
        "http://localhost/api/v1/reports?dateFrom=2026-06-01&dateTo=2026-06-30",
        { Authorization: `Bearer ${apiKey}` },
      ),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { totalIncome: number }
    expect(body.totalIncome).toBe(0)
  })

  it("rejects invalid date range (400)", async () => {
    const res = await reportsGet(
      req("http://localhost/api/v1/reports?dateFrom=2026-07-01&dateTo=2026-06-01", {
        Authorization: `Bearer ${apiKey}`,
      }),
    )
    expect(res.status).toBe(400)
  })
})
