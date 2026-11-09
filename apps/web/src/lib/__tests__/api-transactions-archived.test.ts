import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { POST as bulkPost } from "@/app/api/v1/transactions/bulk/route"
import { POST as createPost } from "@/app/api/v1/transactions/route"
import { __resetMockState, createMockAdapter } from "@/lib/backend/mock"
import { getServerDb } from "@/lib/backend/server-db"
import { openApiSpec } from "@/lib/openapi"

const USER_ID = "mock-user-1"
let apiKey: string
let db: ReturnType<typeof createMockAdapter>["db"]
let openId: string
let closedId: string

beforeEach(async () => {
  __resetMockState()
  const mock = createMockAdapter()
  db = mock.db
  await mock.auth.signIn("test@test.com", "password")
  apiKey = (await db.createApiKey(USER_ID)).key
  const base = { type: "checking" as const, currency: "EUR" as const, balance: 0 }
  openId = (await db.createAccount(USER_ID, { ...base, name: "Open" })).id
  closedId = (await db.createAccount(USER_ID, { ...base, name: "Old" })).id
  await db.updateAccount(USER_ID, closedId, { isArchived: true })
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

function post(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
}

const stored = async () => (await db.getTransactions(USER_ID, {})).total

describe("REST API writes into a closed account", () => {
  it.each([
    ["accountId", () => ({ accountId: closedId })],
    ["transferToAccountId", () => ({ type: "transfer", transferToAccountId: closedId })],
  ])("create refuses an archived %s and stores nothing", async (_n, over) => {
    const res = await createPost(post("http://localhost/api/v1/transactions", tx(over())))
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error).toEqual({ code: "ACCOUNT_CLOSED", message: 'Account "Old" is closed.' })
    expect(await stored()).toBe(0)
  })

  it("create into an open account still works", async () => {
    const res = await createPost(post("http://localhost/api/v1/transactions", tx({})))
    expect(res.status).toBe(201)
  })

  it.each([
    ["accountId", () => ({ accountId: closedId }), 1],
    ["transferToAccountId", () => ({ type: "transfer", transferToAccountId: closedId }), 2],
  ])("bulk refuses the whole request on an archived %s, naming the row", async (_n, over, at) => {
    const rows = [tx({}), tx({}), tx({}), tx({})]
    rows[at] = tx(over())
    const res = await bulkPost(post("http://localhost/api/v1/transactions/bulk", { transactions: rows }))
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error).toEqual({ code: "ACCOUNT_CLOSED", message: `Row ${at}: account "Old" is closed.` })
    expect(await stored()).toBe(0)
  })

  it("bulk answers 500 in the API's error shape when the account read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(getServerDb(), "getAccounts").mockRejectedValueOnce(new Error("backend down"))
    const res = await bulkPost(post("http://localhost/api/v1/transactions/bulk", { transactions: [tx({})] }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Internal error" } })
  })

  it.each(["/api/v1/transactions", "/api/v1/transactions/bulk"])("OpenAPI lists 409 on POST %s", (path) => {
    const op = (openApiSpec.paths as unknown as Record<string, { post: { responses: Record<string, unknown> } }>)[path].post
    expect(op.responses["409"]).toMatchObject({ description: "Account is closed" })
    expect(op.responses["422"]).toMatchObject({ description: "Account does not exist" })
  })
})
