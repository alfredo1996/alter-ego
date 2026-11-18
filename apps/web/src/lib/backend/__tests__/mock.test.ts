import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

import { createMockAdapter, __resetMockState } from "../mock"

import type { BackendAdapter, DatabaseAdapter } from "../types"

const USER = "user-1"

let adapter: BackendAdapter
let db: DatabaseAdapter

beforeEach(() => {
  __resetMockState()
  adapter = createMockAdapter()
  db = adapter.db
})

// ─── Auth adapter ─────────────────────────────────────────────────────────────

describe("auth adapter", () => {
  afterEach(async () => {
    // Ensure mockUser is cleared between tests (not reset by __resetMockState)
    await adapter.auth.signOut()
  })

  it("signIn returns a user with the given email and a derived displayName", async () => {
    const user = await adapter.auth.signIn("alice@example.com", "pass")
    expect(user.email).toBe("alice@example.com")
    expect(user.displayName).toBe("alice")
    expect(user.id).toBeTruthy()
  })

  it("signUp returns a user with the provided displayName", async () => {
    const user = await adapter.auth.signUp("bob@example.com", "pass", "Bob")
    expect(user.email).toBe("bob@example.com")
    expect(user.displayName).toBe("Bob")
  })

  it("getCurrentUser returns null when no user is signed in", async () => {
    expect(await adapter.auth.getCurrentUser()).toBeNull()
  })

  it("getCurrentUser returns the signed-in user", async () => {
    await adapter.auth.signIn("alice@example.com", "pass")
    const user = await adapter.auth.getCurrentUser()
    expect(user?.email).toBe("alice@example.com")
  })

  it("signOut clears the current user", async () => {
    await adapter.auth.signIn("alice@example.com", "pass")
    await adapter.auth.signOut()
    expect(await adapter.auth.getCurrentUser()).toBeNull()
  })

  it("onAuthStateChanged fires immediately and on each auth change", async () => {
    const events: Array<string | null> = []
    const unsub = adapter.auth.onAuthStateChanged((u) =>
      events.push(u ? u.email : null)
    )
    expect(events).toHaveLength(1)   // immediate call with null
    expect(events[0]).toBeNull()

    await adapter.auth.signIn("alice@example.com", "pass")
    expect(events).toHaveLength(2)
    expect(events[1]).toBe("alice@example.com")

    await adapter.auth.signOut()
    expect(events).toHaveLength(3)
    expect(events[2]).toBeNull()

    unsub()
    // After unsubscribing the callback should no longer fire
    await adapter.auth.signIn("bob@example.com", "pass")
    expect(events).toHaveLength(3)
  })
})
// ─── AI adapter ───────────────────────────────────────────────────────────────

describe("ai adapter", () => {
  it("chat returns a non-empty string", async () => {
    const response = await adapter.ai.chat(USER, "Hello")
    expect(typeof response).toBe("string")
    expect(response.length).toBeGreaterThan(0)
  })

  it("categorize returns null in mock mode", async () => {
    const result = await adapter.ai.categorize("Coffee")
    expect(result).toBeNull()
  })
})
// ─── updateProfile ──────────────────────────────────────────────────────────

describe("updateProfile", () => {
  it("updates displayName", async () => {
    await adapter.auth.signUp("test@test.com", "password", "Old Name")
    await adapter.auth.updateProfile({ displayName: "New Name" })
    const user = await adapter.auth.getCurrentUser()
    expect(user?.displayName).toBe("New Name")
  })

  it("updates email", async () => {
    await adapter.auth.signUp("old@test.com", "password", "Name")
    await adapter.auth.updateProfile({ email: "new@test.com" })
    const user = await adapter.auth.getCurrentUser()
    expect(user?.email).toBe("new@test.com")
  })

  it("throws when not signed in", async () => {
    await expect(adapter.auth.updateProfile({ displayName: "X" })).rejects.toThrow("Not signed in")
  })

  it("notifies auth listeners after update", async () => {
    await adapter.auth.signUp("test@test.com", "password", "Old Name")
    let notifiedName: string | null = null
    adapter.auth.onAuthStateChanged((u) => { notifiedName = u?.displayName ?? null })
    await adapter.auth.updateProfile({ displayName: "New Name" })
    expect(notifiedName).toBe("New Name")
  })
})
// ─── __resetMockState ────────────────────────────────────────────────────────

describe("__resetMockState", () => {
  it("clears auth state and callbacks", async () => {
    await adapter.auth.signUp("test@test.com", "password", "Name")
    __resetMockState()
    adapter = createMockAdapter()
    const user = await adapter.auth.getCurrentUser()
    expect(user).toBeNull()
  })
})

describe("window.__MOCK_LATENCY_MS__", () => {
  const g = globalThis as { __MOCK_LATENCY_MS__?: number }

  afterEach(() => {
    delete g.__MOCK_LATENCY_MS__
    vi.useRealTimers()
  })

  it("holds every db call that long, so e2e can see loading states", async () => {
    vi.useFakeTimers()
    await db.createAccount(USER, { name: "Slow", type: "checking", currency: "EUR", balance: 0 })
    g.__MOCK_LATENCY_MS__ = 400

    let accounts: unknown[] | undefined
    const read = db.getAccounts(USER).then((a) => (accounts = a))
    await vi.advanceTimersByTimeAsync(399)
    expect(accounts).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    await read
    expect(accounts).toHaveLength(1)
  })
})
