import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it } from "vitest"

import { GET as accountGet } from "@/app/api/v1/accounts/[id]/route"
import { GET as transactionGet } from "@/app/api/v1/transactions/[id]/route"
import { __resetMockState, createMockAdapter } from "@/lib/backend/mock"

const USER_ID = "mock-user-1"
const OTHER_USER_ID = "mock-user-2"
let apiKey: string
let otherKey: string
let db: ReturnType<typeof createMockAdapter>["db"]
let accountId: string
let transactionId: string

beforeEach(async () => {
  __resetMockState()
  const mock = createMockAdapter()
  db = mock.db
  await mock.auth.signIn("test@test.com", "password")
  apiKey = (await db.createApiKey(USER_ID)).key
  otherKey = (await db.createApiKey(OTHER_USER_ID)).key
  accountId = (
    await db.createAccount(USER_ID, { name: "Checking", type: "checking", currency: "EUR", balance: 0 })
  ).id
  transactionId = (
    await db.createTransaction(USER_ID, {
      accountId,
      type: "expense",
      amount: 10,
      currency: "EUR",
      description: "Coffee",
      date: new Date("2026-06-15"),
      categoryId: null,
    })
  ).id
})

function req(url: string, key?: string): NextRequest {
  return new NextRequest(url, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe("GET /api/v1/transactions/{id}", () => {
  it("returns 401 without an API key", async () => {
    const res = await transactionGet(req(`http://localhost/api/v1/transactions/${transactionId}`), params(transactionId))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe("UNAUTHORIZED")
  })

  it("returns 401 with a wrong API key", async () => {
    const res = await transactionGet(
      req(`http://localhost/api/v1/transactions/${transactionId}`, "ak_wrong"),
      params(transactionId)
    )
    expect(res.status).toBe(401)
  })

  it("returns 200 with the transaction for its owner", async () => {
    const res = await transactionGet(
      req(`http://localhost/api/v1/transactions/${transactionId}`, apiKey),
      params(transactionId)
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.id).toBe(transactionId)
    expect(body.userId).toBe(USER_ID)
    expect(body.accountId).toBe(accountId)
    expect(body.type).toBe("expense")
    expect(body.amount).toBe(10)
    expect(body.currency).toBe("EUR")
    expect(body.description).toBe("Coffee")
  })

  it("returns 404 for an unknown id", async () => {
    const res = await transactionGet(
      req("http://localhost/api/v1/transactions/no-such-tx", apiKey),
      params("no-such-tx")
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe("NOT_FOUND")
  })

  it("returns 404 for a transaction owned by another user", async () => {
    const res = await transactionGet(
      req(`http://localhost/api/v1/transactions/${transactionId}`, otherKey),
      params(transactionId)
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe("NOT_FOUND")
  })
})

describe("GET /api/v1/accounts/{id}", () => {
  it("returns 401 without an API key", async () => {
    const res = await accountGet(req(`http://localhost/api/v1/accounts/${accountId}`), params(accountId))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe("UNAUTHORIZED")
  })

  it("returns 401 with a wrong API key", async () => {
    const res = await accountGet(
      req(`http://localhost/api/v1/accounts/${accountId}`, "ak_wrong"),
      params(accountId)
    )
    expect(res.status).toBe(401)
  })

  it("returns 200 with the account for its owner", async () => {
    const res = await accountGet(
      req(`http://localhost/api/v1/accounts/${accountId}`, apiKey),
      params(accountId)
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.id).toBe(accountId)
    expect(body.userId).toBe(USER_ID)
    expect(body.name).toBe("Checking")
    expect(body.type).toBe("checking")
    expect(body.currency).toBe("EUR")
  })

  it("returns 404 for an unknown id", async () => {
    const res = await accountGet(
      req("http://localhost/api/v1/accounts/no-such-account", apiKey),
      params("no-such-account")
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe("NOT_FOUND")
  })

  it("returns 404 for an account owned by another user", async () => {
    const res = await accountGet(
      req(`http://localhost/api/v1/accounts/${accountId}`, otherKey),
      params(accountId)
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe("NOT_FOUND")
  })
})
