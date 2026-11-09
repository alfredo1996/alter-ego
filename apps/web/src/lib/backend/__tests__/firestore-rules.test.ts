/**
 * Firestore Security Rules — negative/positive tests (emulator).
 *
 * The adapter contract only ever sends valid, owner-scoped data, so the rules'
 * field validation, ownership, and business constraints were untested. Here the
 * client SDK runs with rules ENFORCED: we assert that invalid writes and
 * cross-user access are rejected, and that valid writes succeed.
 *
 * Runs under the Firebase emulator (vitest.emulator.ts).
 */
import { createUserWithEmailAndPassword } from "firebase/auth"
import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  setDoc,
  updateDoc,
} from "firebase/firestore"
import { beforeAll, describe, it, expect } from "vitest"

import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase-client"

import { emulatorHosts, firestoreRestBase } from "./emulator-hosts"

let uid = ""
const OTHER = "some-other-user-uid"
const db = () => getFirebaseDb()

// A doc id counter so each create targets a fresh path (avoids update-vs-create ambiguity).
let n = 0
const freshId = () => `r${++n}`

const validAccount = (o: Record<string, unknown> = {}) => ({
  userId: uid, name: "Checking", type: "checking", kind: null,
  currency: "USD", balance: 0, openingBalance: 0, isArchived: false, ...o,
})
const validTransaction = (o: Record<string, unknown> = {}) => ({
  userId: uid, accountId: "acc1", type: "expense", amount: 10, currency: "USD",
  description: "coffee", date: new Date(), tagIds: [], splits: [],
  isRecurring: false, excludeFromReports: false, ...o,
})
const validCategory = (o: Record<string, unknown> = {}) => ({
  userId: uid, name: "Fun", group: "entertainment", icon: "party", color: "#fff",
  isDefault: false, ...o,
})
const listOf = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`)

const mine = (col: string) => doc(db(), `users/${uid}/${col}/${freshId()}`)
const theirs = (col: string) => doc(db(), `users/${OTHER}/${col}/${freshId()}`)

beforeAll(async () => {
  const auth = getFirebaseAuth()
  const email = `rules-${Date.now()}@example.com`
  const { user } = await createUserWithEmailAndPassword(auth, email, "Test1234!")
  uid = user.uid
})

describe("cross-user isolation", () => {
  it("cannot read another user's account", async () => {
    await expect(getDoc(theirs("accounts"))).rejects.toThrow()
  })
  it("cannot read another user's category copy", async () => {
    await expect(getDoc(theirs("categories"))).rejects.toThrow()
  })
  it("cannot write to another user's account", async () => {
    await expect(setDoc(theirs("accounts"), validAccount({ userId: OTHER }))).rejects.toThrow()
  })
  it("cannot delete another user's transaction", async () => {
    await expect(deleteDoc(theirs("transactions"))).rejects.toThrow()
  })
})

describe("account validation", () => {
  it("accepts a valid account", async () => {
    await setDoc(mine("accounts"), validAccount())
  })
  it("rejects a mismatched userId", async () => {
    await expect(setDoc(mine("accounts"), validAccount({ userId: OTHER }))).rejects.toThrow()
  })
  it("rejects an oversized name", async () => {
    await expect(setDoc(mine("accounts"), validAccount({ name: "x".repeat(101) }))).rejects.toThrow()
  })
  it("rejects an invalid currency", async () => {
    await expect(setDoc(mine("accounts"), validAccount({ currency: "FAKE" }))).rejects.toThrow()
  })
  it("rejects a non-number balance", async () => {
    await expect(setDoc(mine("accounts"), validAccount({ balance: "100" }))).rejects.toThrow()
  })
  it("rejects a non-number openingBalance", async () => {
    await expect(setDoc(mine("accounts"), validAccount({ openingBalance: "0" }))).rejects.toThrow()
  })
  it("rejects an invalid kind", async () => {
    await expect(setDoc(mine("accounts"), validAccount({ kind: "hybrid" }))).rejects.toThrow()
  })
  it("accepts a custom (free-form) account type but rejects an oversized one", async () => {
    await setDoc(mine("accounts"), validAccount({ type: "Crypto Wallet" }))
    await expect(setDoc(mine("accounts"), validAccount({ type: "y".repeat(51) }))).rejects.toThrow()
  })
})

describe("transaction validation", () => {
  it("accepts a valid transaction", async () => {
    await setDoc(mine("transactions"), validTransaction())
  })
  it("keeps a long bank memo in rawDescription, as the importer writes it", async () => {
    await setDoc(mine("transactions"), validTransaction({ rawDescription: "m".repeat(3000) }))
  })
  it("rejects attachments, which the app never writes", async () => {
    await expect(setDoc(mine("transactions"), validTransaction({ attachments: ["junk"] }))).rejects.toThrow()
  })
  it("rejects an invalid type", async () => {
    await expect(setDoc(mine("transactions"), validTransaction({ type: "hacked" }))).rejects.toThrow()
  })
  it("rejects a negative amount", async () => {
    await expect(setDoc(mine("transactions"), validTransaction({ amount: -5 }))).rejects.toThrow()
  })
  it("rejects an oversized description", async () => {
    await expect(setDoc(mine("transactions"), validTransaction({ description: "z".repeat(501) }))).rejects.toThrow()
  })
  it("accepts a transfer that names a distinct destination", async () => {
    await setDoc(
      mine("transactions"),
      validTransaction({ type: "transfer", transferToAccountId: "acc2" })
    )
  })
  it("rejects a transfer with no destination — the amount would leave the ledger", async () => {
    await expect(
      setDoc(mine("transactions"), validTransaction({ type: "transfer" }))
    ).rejects.toThrow()
    await expect(
      setDoc(mine("transactions"), validTransaction({ type: "transfer", transferToAccountId: null }))
    ).rejects.toThrow()
  })
  it("rejects a transfer to its own source account", async () => {
    await expect(
      setDoc(mine("transactions"), validTransaction({ type: "transfer", transferToAccountId: "acc1" }))
    ).rejects.toThrow()
  })
  it("rejects an update whose merged result is a destinationless transfer", async () => {
    // request.resource.data is the merged document on update, so flipping type
    // alone on an expense must be caught even though the write omits the field.
    const ref = mine("transactions")
    await setDoc(ref, validTransaction())
    await expect(updateDoc(ref, { type: "transfer" })).rejects.toThrow()
  })
})

describe("monthly totals", () => {
  const month = (m: string, col = uid) => doc(db(), `users/${col}/monthly_totals/${m}`)
  const valid = (o: Record<string, unknown> = {}) => ({ total: 12.5, expenseByCategory: { food: 12.5 }, n: 1, ready: true, ...o })

  it("lets the owner write, read, increment and delete a month", async () => {
    await setDoc(month("2026-01"), valid())
    await setDoc(month("2026-01"), { total: increment(5), expenseByCategory: { food: increment(5) }, n: increment(1) }, { merge: true })
    const data = (await getDoc(month("2026-01"))).data()
    expect(data).toMatchObject({ total: 17.5, expenseByCategory: { food: 17.5 }, n: 2, ready: true })
    await deleteDoc(month("2026-01"))
  })
  it.each([
    ["a string total", { total: "12" }],
    ["a string write count", { n: "1" }],
    ["a non-boolean ready", { ready: "yes" }],
    ["a list for the categories", { expenseByCategory: [1, 2] }],
    ["a number for the categories", { expenseByCategory: 5 }],
    ["a field the app never writes", { extra: 1 }],
  ])("refuses %s", async (_name, over) => {
    await expect(setDoc(month("2026-02"), valid(over))).rejects.toThrow()
  })
  it("refuses a document id that is not a month", async () => {
    await expect(setDoc(month("february"), valid())).rejects.toThrow()
  })
  it("keeps another user's months out of reach", async () => {
    await expect(setDoc(month("2026-03", OTHER), valid())).rejects.toThrow()
    await expect(getDoc(month("2026-03", OTHER))).rejects.toThrow()
    await expect(deleteDoc(month("2026-03", OTHER))).rejects.toThrow()
  })
})

describe("category business rules", () => {
  it("accepts a user category", async () => {
    await setDoc(mine("categories"), validCategory())
  })
  it("accepts a user's own copy of a built-in, under the default's id", async () => {
    await setDoc(doc(db(), `users/${uid}/categories/some-default-id`), validCategory({ name: "Home" }))
  })
  it("accepts a copy of a built-in whose icon is the longest default (UtensilsCrossed)", async () => {
    await setDoc(doc(db(), `users/${uid}/categories/some-default-id`), validCategory({ icon: "UtensilsCrossed" }))
  })
  it("rejects a user category claiming isDefault: true", async () => {
    await expect(setDoc(mine("categories"), validCategory({ isDefault: true }))).rejects.toThrow()
  })
})

describe("system categories", () => {
  it("are readable by an authenticated user", async () => {
    // Seeded by globalSetup; a read must be permitted (missing doc resolves, not rejects).
    await getDoc(doc(db(), "categories/does-not-exist"))
  })
  it("cannot be written by a client", async () => {
    await expect(setDoc(doc(db(), "categories/hacked"), { name: "x" })).rejects.toThrow()
  })
})

describe("userId immutability on update", () => {
  it("cannot change userId to another user", async () => {
    const ref = mine("accounts")
    await setDoc(ref, validAccount())
    await expect(updateDoc(ref, { userId: OTHER })).rejects.toThrow()
  })
})

// The Firebase adapter swallows permission-denied and returns [], so a missing or
// wrong rules block on a CRM collection shows an empty screen with no error at all.
// These are the tripwire for that.

describe("api_keys_index read scoping", () => {
  /** Writes a doc as the emulator owner, bypassing rules — the only way to plant another user's row. */
  async function seedIndexDoc(docId: string, ownerUid: string) {
    const res = await fetch(
      `${firestoreRestBase(emulatorHosts().firestore)}/api_keys_index?documentId=${docId}`,
      {
        method: "POST",
        headers: { Authorization: "Bearer owner", "content-type": "application/json" },
        body: JSON.stringify({
          fields: { userId: { stringValue: ownerUid }, keyHash: { stringValue: `hash-${docId}` } },
        }),
      }
    )
    if (!res.ok) throw new Error(`seed failed: ${res.status}`)
  }

  it("can read its own index entry", async () => {
    const id = `idx-mine-${freshId()}`
    await seedIndexDoc(id, uid)
    const snap = await getDoc(doc(db(), `api_keys_index/${id}`))
    expect(snap.data()?.userId).toBe(uid)
  })

  it("cannot read another user's index entry", async () => {
    const id = `idx-theirs-${freshId()}`
    await seedIndexDoc(id, OTHER)
    await expect(getDoc(doc(db(), `api_keys_index/${id}`))).rejects.toThrow()
  })

  it("cannot create an index entry pointing at another user", async () => {
    await expect(
      setDoc(doc(db(), `api_keys_index/idx-forged-${freshId()}`), {
        userId: OTHER,
        keyHash: "forged",
      })
    ).rejects.toThrow()
  })
})

describe("api_keys_index is server-written (#342)", () => {
  // A client-made index row was a working key that Settings never listed.
  it("refuses a client create with no matching api_keys doc", async () => {
    await expect(
      setDoc(doc(db(), `api_keys_index/idx-bare-${freshId()}`), { userId: uid, keyHash: "x" })
    ).rejects.toThrow()
  })

  it("refuses a client create even with a matching api_keys doc", async () => {
    const keyId = `k-${freshId()}`
    // The owner bearer bypasses the rules, as the server does.
    const seed = await fetch(
      `${firestoreRestBase(emulatorHosts().firestore)}/users/${uid}/api_keys?documentId=${keyId}`,
      {
        method: "POST",
        headers: { Authorization: "Bearer owner", "content-type": "application/json" },
        body: JSON.stringify({ fields: { keyHash: { stringValue: "h" } } }),
      }
    )
    expect(seed.ok).toBe(true)
    await expect(
      setDoc(doc(db(), `api_keys_index/idx-paired-${freshId()}`), {
        userId: uid,
        keyHash: "h",
        apiKeyDocId: keyId,
      })
    ).rejects.toThrow()
  })
})

describe("users/{uid}/api_keys is server-created (#342)", () => {
  it("refuses a client create", async () => {
    await expect(
      setDoc(doc(db(), `users/${uid}/api_keys/decoy-${freshId()}`), { userId: uid, keyHash: "x" })
    ).rejects.toThrow()
  })
})

describe("oauth collections are server-only", () => {
  // These hold authorization codes and token hashes. The Admin SDK bypasses
  // rules, so a client has no reason to reach them — and every reason not to.
  for (const col of ["oauth_clients", "oauth_codes", "oauth_tokens"]) {
    it(`rejects reading ${col}`, async () => {
      await expect(getDoc(doc(db(), `${col}/anything`))).rejects.toThrow()
    })
    it(`rejects writing ${col}`, async () => {
      await expect(setDoc(doc(db(), `${col}/anything`), { x: 1 })).rejects.toThrow()
    })
  }
})

describe("mcp collections are server-only", () => {
  // The MCP audit trail is Admin-SDK-only: a client reading it would see tool params.
  for (const col of ["mcp_audit"]) {
    it(`rejects reading own ${col}`, async () => {
      await expect(getDoc(doc(db(), `users/${uid}/${col}/anything`))).rejects.toThrow()
    })
    it(`rejects writing own ${col}`, async () => {
      await expect(setDoc(doc(db(), `users/${uid}/${col}/anything`), { x: 1 })).rejects.toThrow()
    })
  }
})

// ── Closed schemas (#352) ────────────────────────────────────────────────────
//
// Every collection takes only the fields the app writes, with a type for each.
// `wrong` is one field of the wrong type; `id` is for the collections whose
// document id is part of the key.

interface Closed {
  col: string
  doc: () => Record<string, unknown>
  wrong: Record<string, unknown>
  id?: (d: Record<string, unknown>) => string
  noUpdate?: boolean
}
const ts = () => new Date()
const CLOSED: Closed[] = [
  { col: "accounts", doc: () => validAccount(), wrong: { balance: "5" } },
  { col: "transactions", doc: () => validTransaction(), wrong: { date: "2026-01-01" } },
  { col: "categories", doc: () => validCategory(), wrong: { icon: 5 } },
  {
    col: "budgets",
    doc: () => ({ userId: uid, name: "Food", amount: 100, currency: "USD", period: "monthly", rolloverMode: "reset", categoryId: null }),
    wrong: { name: 5 },
  },
  {
    col: "savings_goals",
    doc: () => ({ userId: uid, name: "Trip", targetAmount: 100, currentAmount: 0, currency: "USD", isCompleted: false, targetDate: null }),
    wrong: { isCompleted: "no" },
  },
  {
    col: "recurring",
    doc: () => ({
      userId: uid, accountId: "a1", type: "expense", amount: 5, currency: "USD", description: "Gym", frequency: "monthly",
      interval: 1, startDate: ts(), nextDueDate: ts(), endDate: null, isActive: true, loanMeta: null, categoryId: null, notes: null,
    }),
    wrong: { startDate: "tomorrow" },
  },
  { col: "tags", doc: () => ({ userId: uid, name: "Trip", color: "#fff" }), wrong: { name: 5 } },
  {
    col: "categorization_rules",
    doc: () => ({ userId: uid, pattern: "coffee", categoryId: "c1", displayAs: null, isActive: true }),
    wrong: { categoryId: 5 },
  },
  {
    col: "dismissed_subscription_patterns",
    doc: () => ({ userId: uid, patternKey: "netflix", dismissedAt: ts() }),
    wrong: { patternKey: 5 },
    noUpdate: true,
  },
  {
    col: "account_balance_snapshots",
    doc: () => ({ userId: uid, accountId: "a1", balance: 10, date: ts() }),
    wrong: { balance: "10" },
  },
  {
    col: "net_worth_snapshots",
    doc: () => ({ userId: uid, date: ts(), totalAssets: 10, totalLiabilities: 2, netWorth: 8 }),
    wrong: { netWorth: "8" },
  },
]

describe("recurring loanMeta", () => {
  const rule = (loanMeta: unknown) => ({
    userId: uid, accountId: "a1", type: "expense", amount: 5, currency: "USD", description: "Loan", frequency: "monthly",
    interval: 1, startDate: ts(), nextDueDate: ts(), endDate: null, isActive: true, loanMeta, categoryId: null, notes: null,
  })
  const meta = { loanAmount: 1000, annualRate: 6.5, termMonths: 12, paymentStartMonth: 1 }
  it("accepts the loan shape the app writes", async () => {
    await setDoc(mine("recurring"), rule(meta))
  })
  it.each([
    ["an extra key", { ...meta, junk: "j" }],
    ["a string rate", { ...meta, annualRate: "6.5" }],
  ])("rejects %s", async (_n, loanMeta) => {
    await expect(setDoc(mine("recurring"), rule(loanMeta))).rejects.toThrow()
  })
})

describe.each(CLOSED)("$col has a closed schema", (c) => {
  const at = (d: Record<string, unknown>) => doc(db(), `users/${uid}/${c.col}/${c.id ? c.id(d) : freshId()}`)

  it("accepts a valid document", async () => {
    const d = c.doc()
    await setDoc(at(d), d)
  })
  it("refuses a create with an unknown field", async () => {
    const d = c.doc()
    await expect(setDoc(at(d), { ...d, isAdmin: true })).rejects.toThrow()
  })
  it("refuses a create with a wrong-typed field", async () => {
    const d = c.doc()
    await expect(setDoc(at(d), { ...d, ...c.wrong })).rejects.toThrow()
  })
  if (!c.noUpdate) {
    it("refuses an update that adds an unknown field", async () => {
      const d = c.doc()
      const ref = at(d)
      await setDoc(ref, d)
      await expect(updateDoc(ref, { isAdmin: true })).rejects.toThrow()
    })
    it("refuses an update that sets a field to the wrong type", async () => {
      const d = c.doc()
      const ref = at(d)
      await setDoc(ref, d)
      await expect(updateDoc(ref, c.wrong)).rejects.toThrow()
    })
    it("refuses an update that deletes userId", async () => {
      const d = c.doc()
      const ref = at(d)
      await setDoc(ref, d)
      await expect(updateDoc(ref, { userId: deleteField() })).rejects.toThrow()
    })
  }
})

describe("numbers (#352)", () => {
  it.each([NaN, Infinity, -Infinity, 1e15])("refuses %s as an amount", async (bad) => {
    await expect(setDoc(mine("accounts"), validAccount({ balance: bad }))).rejects.toThrow()
    await expect(setDoc(mine("transactions"), validTransaction({ amount: bad }))).rejects.toThrow()
  })
  it("refuses 20,000 tag ids", async () => {
    await expect(setDoc(mine("transactions"), validTransaction({ tagIds: listOf(20000) }))).rejects.toThrow()
  })
})

describe("dismissed pattern key length (#352)", () => {
  it("takes a key as long as the app builds and refuses one past 800", async () => {
    await setDoc(mine("dismissed_subscription_patterns"), { userId: uid, patternKey: "k".repeat(800), dismissedAt: ts() })
    await expect(
      setDoc(mine("dismissed_subscription_patterns"), { userId: uid, patternKey: "k".repeat(801), dismissedAt: ts() }),
    ).rejects.toThrow()
  })
})

describe("default deny (#352)", () => {
  it("refuses a collection-group query", async () => {
    await expect(getDocs(collectionGroup(db(), "transactions"))).rejects.toThrow()
  })
  it("refuses listing another user's collection", async () => {
    await expect(getDocs(collection(db(), `users/${OTHER}/accounts`))).rejects.toThrow()
  })
  it("refuses the user document, an unknown subcollection and an unknown top-level path", async () => {
    await expect(getDoc(doc(db(), `users/${uid}`))).rejects.toThrow()
    await expect(getDoc(doc(db(), `users/${uid}/unknown/x`))).rejects.toThrow()
    await expect(setDoc(doc(db(), `users/${uid}/unknown/x`), { userId: uid })).rejects.toThrow()
    await expect(getDoc(doc(db(), "whatever/x"))).rejects.toThrow()
  })
  it("refuses a list and a collection-group query of the server-only collections", async () => {
    for (const col of ["mcp_audit"]) {
      await expect(getDocs(collection(db(), `users/${uid}/${col}`))).rejects.toThrow()
      await expect(getDocs(collectionGroup(db(), col))).rejects.toThrow()
    }
    for (const col of ["oauth_clients", "oauth_codes", "oauth_tokens"]) {
      await expect(getDocs(collection(db(), col))).rejects.toThrow()
    }
  })
})

describe("signed out (#352)", () => {
  const base = () => firestoreRestBase(emulatorHosts().firestore)
  it.each(["accounts", "transactions", "budgets"])("refuses a read of %s", async (col) => {
    const res = await fetch(`${base()}/users/${uid}/${col}/x`)
    expect(res.status).toBe(403)
    const list = await fetch(`${base()}/users/${uid}/${col}`)
    expect(list.status).toBe(403)
  })
  it("refuses a write", async () => {
    const res = await fetch(`${base()}/users/${uid}/accounts?documentId=signedout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fields: { userId: { stringValue: uid } } }),
    })
    expect(res.status).toBe(403)
  })
  it("refuses a collection-group query", async () => {
    const res = await fetch(`${base()}:runQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "transactions", allDescendants: true }] } }),
    })
    expect(res.status).toBe(403)
  })
})
