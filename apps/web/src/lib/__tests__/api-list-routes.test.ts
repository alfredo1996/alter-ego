import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it } from "vitest"

import { GET as budgetsGet } from "@/app/api/v1/budgets/route"
import { GET as categoriesGet } from "@/app/api/v1/categories/route"
import { GET as recurringGet } from "@/app/api/v1/recurring/route"
import { GET as tagsGet } from "@/app/api/v1/tags/route"
import { __resetMockState, createMockAdapter } from "@/lib/backend/mock"

const USER_ID = "mock-user-1"
const OTHER_USER_ID = "mock-user-2"
let apiKey: string
let otherKey: string
let db: ReturnType<typeof createMockAdapter>["db"]
let accountId: string
let customCategoryId: string

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
  customCategoryId = (
    await db.createCategory(USER_ID, { name: "Coffee", group: "food", icon: "Coffee", color: "#6b4f2a" })
  ).id
  await db.createBudget(USER_ID, { name: "Food", categoryId: customCategoryId, amount: 500, currency: "EUR", period: "monthly" })
  await db.createRecurringTransaction(USER_ID, {
    accountId,
    type: "expense",
    amount: 10,
    currency: "EUR",
    description: "Streaming",
    frequency: "monthly",
    startDate: new Date("2026-06-01"),
  })
  await db.createTag(USER_ID, { name: "work", color: "#ff0000" })
})

function req(url: string, key?: string): NextRequest {
  return new NextRequest(url, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  })
}

type ListBody = { data: { id: string; userId?: string }[] }

describe("read-only /api/v1 lists", () => {
  it.each([
    ["budgets", budgetsGet],
    ["categories", categoriesGet],
    ["recurring", recurringGet],
    ["tags", tagsGet],
  ] as const)("GET /api/v1/%s returns 401 without an API key", async (name, handler) => {
    const res = await handler(req(`http://localhost/api/v1/${name}`))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe("UNAUTHORIZED")
  })

  it.each([
    ["budgets", budgetsGet],
    ["categories", categoriesGet],
    ["recurring", recurringGet],
    ["tags", tagsGet],
  ] as const)("GET /api/v1/%s returns 401 with a wrong API key", async (name, handler) => {
    const res = await handler(req(`http://localhost/api/v1/${name}`, "ak_wrong"))
    expect(res.status).toBe(401)
  })
})

describe("GET /api/v1/budgets", () => {
  it("returns 200 with the user's budgets in { data }", async () => {
    const res = await budgetsGet(req("http://localhost/api/v1/budgets", apiKey))
    expect(res.status).toBe(200)
    const body = (await res.json()) as ListBody
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].userId).toBe(USER_ID)
  })

  it("returns an empty list for another user's key", async () => {
    const res = await budgetsGet(req("http://localhost/api/v1/budgets", otherKey))
    expect(res.status).toBe(200)
    expect((await res.json()) as ListBody).toEqual({ data: [] })
  })
})

describe("GET /api/v1/categories", () => {
  it("returns 200 with the user's custom category among the defaults", async () => {
    const res = await categoriesGet(req("http://localhost/api/v1/categories", apiKey))
    expect(res.status).toBe(200)
    const body = (await res.json()) as ListBody
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.some((c) => c.id === customCategoryId)).toBe(true)
  })

  it("does not leak another user's custom category", async () => {
    const res = await categoriesGet(req("http://localhost/api/v1/categories", otherKey))
    expect(res.status).toBe(200)
    const body = (await res.json()) as ListBody
    expect(body.data.some((c) => c.id === customCategoryId)).toBe(false)
  })
})

describe("GET /api/v1/recurring", () => {
  it("returns 200 with the user's recurring transactions in { data }", async () => {
    const res = await recurringGet(req("http://localhost/api/v1/recurring", apiKey))
    expect(res.status).toBe(200)
    const body = (await res.json()) as ListBody
    expect(body.data).toHaveLength(1)
    expect(body.data[0].userId).toBe(USER_ID)
  })

  it("returns an empty list for another user's key", async () => {
    const res = await recurringGet(req("http://localhost/api/v1/recurring", otherKey))
    expect(res.status).toBe(200)
    expect((await res.json()) as ListBody).toEqual({ data: [] })
  })
})

describe("GET /api/v1/tags", () => {
  it("returns 200 with the user's tags in { data }", async () => {
    const res = await tagsGet(req("http://localhost/api/v1/tags", apiKey))
    expect(res.status).toBe(200)
    const body = (await res.json()) as ListBody
    expect(body.data).toHaveLength(1)
    expect(body.data[0].userId).toBe(USER_ID)
  })

  it("returns an empty list for another user's key", async () => {
    const res = await tagsGet(req("http://localhost/api/v1/tags", otherKey))
    expect(res.status).toBe(200)
    expect((await res.json()) as ListBody).toEqual({ data: [] })
  })
})
