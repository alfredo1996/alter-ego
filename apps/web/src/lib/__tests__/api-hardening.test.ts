import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { GET as accountsGet } from "@/app/api/v1/accounts/route"
import { POST as bulkPost } from "@/app/api/v1/transactions/bulk/route"
import { GET as txGet, POST as createPost } from "@/app/api/v1/transactions/route"
import { __resetMockState, createMockAdapter } from "@/lib/backend/mock"
import { getServerDb } from "@/lib/backend/server-db"
import { createTransactionSchema, updateTransactionSchema } from "@/types/schemas"

const USER_ID = "mock-user-1"
let apiKey: string
let db: ReturnType<typeof createMockAdapter>["db"]
let openId: string

beforeEach(async () => {
  __resetMockState()
  const mock = createMockAdapter()
  db = mock.db
  await mock.auth.signIn("test@test.com", "password")
  apiKey = (await db.createApiKey(USER_ID)).key
  openId = (
    await db.createAccount(USER_ID, { name: "Open", type: "checking", currency: "EUR", balance: 0 })
  ).id
})

const tx = (over: Record<string, unknown>) => ({
  accountId: openId,
  type: "expense",
  amount: 10,
  currency: "EUR",
  description: "Coffee",
  date: "2026-06-15",
  categoryId: null,
  ...over,
})

const post = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })

const stored = async () => (await db.getTransactions(USER_ID, {})).total

describe("REST API 500s", () => {
  it("answer a generic message and log the cause server-side", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(getServerDb(), "getAccounts").mockRejectedValueOnce(
      new Error("path < projects/demo-alter-ego/users/u1/accounts >")
    )
    const res = await accountsGet(
      new NextRequest("http://localhost/api/v1/accounts", { headers: { Authorization: `Bearer ${apiKey}` } })
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Internal error" } })
    expect(log).toHaveBeenCalledTimes(1)
  })
})

describe("REST API writes naming an unknown account", () => {
  it.each([
    ["accountId", () => ({ accountId: "no-such-account" })],
    ["transferToAccountId", () => ({ type: "transfer", transferToAccountId: "no-such-account" })],
  ])("create answers 422 for an unknown %s and stores nothing", async (_n, over) => {
    const res = await createPost(post("http://localhost/api/v1/transactions", tx(over())))
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe("UNKNOWN_ACCOUNT")
    expect(await stored()).toBe(0)
  })

  it("bulk refuses the whole request on one unknown account, naming the row", async () => {
    const rows = [tx({}), tx({ accountId: "no-such-account" })]
    const res = await bulkPost(post("http://localhost/api/v1/transactions/bulk", { transactions: rows }))
    expect(res.status).toBe(422)
    expect((await res.json()).error.message).toBe('Row 1: account "no-such-account" does not exist.')
    expect(await stored()).toBe(0)
  })
})

describe("ids are single path segments", () => {
  it.each(["a/b", "../x"])("the schemas refuse %s", (bad) => {
    const ok = tx({})
    const date = new Date("2026-06-15")
    expect(createTransactionSchema.safeParse({ ...ok, date, accountId: bad }).success).toBe(false)
    expect(createTransactionSchema.safeParse({ ...ok, date, categoryId: bad }).success).toBe(false)
    expect(updateTransactionSchema.safeParse({ transferToAccountId: bad }).success).toBe(false)
  })

  it("create answers 400 for an id with a slash", async () => {
    const res = await createPost(post("http://localhost/api/v1/transactions", tx({ accountId: "a/b" })))
    expect(res.status).toBe(400)
    expect(await stored()).toBe(0)
  })
})

describe("bulk row failures", () => {
  it("answer a generic message per row and log the cause", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    log.mockClear()
    vi.spyOn(getServerDb(), "createTransaction").mockRejectedValueOnce(new Error("path < users/u1 >"))
    const res = await bulkPost(post("http://localhost/api/v1/transactions/bulk", { transactions: [tx({})] }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      created: [],
      errors: [{ index: 0, message: "Could not create this transaction." }],
    })
    expect(log).toHaveBeenCalledTimes(1)
  })
})

describe("transaction list filters", () => {
  it.each(["accountId", "categoryId"])("treat an empty %s as no filter", async (key) => {
    const res = await txGet(
      new NextRequest(`http://localhost/api/v1/transactions?${key}=`, { headers: { Authorization: `Bearer ${apiKey}` } })
    )
    expect(res.status).toBe(200)
  })

  it("refuse a slash in accountId", async () => {
    const res = await txGet(
      new NextRequest("http://localhost/api/v1/transactions?accountId=a/b", { headers: { Authorization: `Bearer ${apiKey}` } })
    )
    expect(res.status).toBe(400)
  })
})
