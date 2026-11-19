/**
 * firestore.rules is generated from firestore/base.rules and the finance package's
 * finance.rules and finance-root.rules, and it is the file
 * Firebase actually deploys. These assertions are the drift guard: edit the
 * fragment without rebuilding and this fails here rather than at deploy time,
 * when the mismatch is a security change nobody reviewed.
 */
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { buildRules } from "../../../../../scripts/build-firestore-rules.mjs"

const base = readFileSync("../../firestore/base.rules", "utf8")
const finance = readFileSync("../../packages/modules/finance/src/finance.rules", "utf8")
const financeRoot = readFileSync("../../packages/modules/finance/src/finance-root.rules", "utf8")
const VALIDATORS = [
  "isValidAccountType",
  "isValidAccountKind",
  "isValidTransactionType",
  "transferHasDestination",
  "isValidCurrency",
  "isValidBudgetPeriod",
  "isValidRolloverMode",
  "isValidRecurringFrequency",
  "isValidCategoryGroup",
]
const ROOT_MARKER = "    // @@ROOT_COLLECTIONS@@"
const USERS_MARKER = "      // @@CRM_COLLECTIONS@@"

const ACCOUNTING_COLLECTIONS = [
  "accounts",
  "transactions",
  "budgets",
  "savings_goals",
  "recurring",
  "tags",
  "api_keys",
]

describe("firestore rules build", () => {
  it("matches the committed firestore.rules", () => {
    expect(buildRules({ base, finance, financeRoot })).toBe(readFileSync("../../firestore.rules", "utf8"))
  })

  it("takes the finance collections from the package fragment, so editing it changes the output", () => {
    const edited = buildRules({ base, financeRoot, finance: finance.replace("match /accounts/", "match /accounts_x/") })
    expect(edited).toContain("match /accounts_x/")
    expect(edited).not.toBe(buildRules({ base, finance, financeRoot }))
    expect(base).not.toContain("match /accounts/")
  })

  it("refuses a base with no users marker", () => {
    expect(() => buildRules({ base: ROOT_MARKER, finance, financeRoot })).toThrow(/CRM_COLLECTIONS/)
  })

  it("refuses a base with no root marker", () => {
    expect(() => buildRules({ base: USERS_MARKER, finance, financeRoot })).toThrow(/ROOT_COLLECTIONS/)
  })

  it("refuses a missing fragment", () => {
    const b = `${ROOT_MARKER}\n${USERS_MARKER}`
    expect(() => buildRules({ base: b, finance: "", financeRoot })).toThrow(/finance\.rules is empty/)
    expect(() => buildRules({ base: b, finance, financeRoot: " \n" })).toThrow(/finance-root\.rules is empty/)
  })

  it("puts each fragment where its marker was, and nothing else moves", () => {
    expect(
      buildRules({
        base: `head\n\n${ROOT_MARKER}\n\nmid\n\n${USERS_MARKER}\n\ntail\n`,
        finance: "      // frag $& $1\n\n",
        financeRoot: "    // root $&\n",
      }),
    ).toBe("head\n\n    // root $&\n\nmid\n\n      // frag $& $1\n\ntail\n")
  })

  it("declares the finance validators in the fragment, not in base.rules", () => {
    for (const v of VALIDATORS) {
      expect(finance, v).toMatch(new RegExp(`^ {6}function ${v}\\(`, "m"))
      expect(base, v).not.toContain(v)
    }
  })

  it("splices the root fragment at the root marker, and base.rules no longer holds categories", () => {
    expect(base).toContain(ROOT_MARKER)
    expect(base).not.toContain("match /categories/")
    expect(financeRoot).toContain("match /categories/{categoryId}")
    const out = buildRules({ base, finance, financeRoot })
    expect(out).toContain(financeRoot.trimEnd())
    expect(out).not.toContain("@@ROOT_COLLECTIONS@@")
  })

  it("takes the root collections from the root fragment, so editing it changes the output", () => {
    const edited = buildRules({ base, finance, financeRoot: financeRoot.replace("allow read:", "allow get:") })
    expect(edited).not.toBe(buildRules({ base, finance, financeRoot }))
  })

  describe("the build", () => {
    const out = buildRules({ base, finance, financeRoot })

    it("keeps every accounting collection", () => {
      for (const c of ACCOUNTING_COLLECTIONS) expect(out, c).toContain(`match /${c}/`)
    })

    it("is structurally whole", () => {
      expect((out.match(/{/g) ?? []).length).toBe((out.match(/}/g) ?? []).length)
      expect(out).toMatch(/^rules_version = '2';/)
      expect(out.trimEnd().endsWith("}")).toBe(true)
    })

    it("leaves no marker behind", () => {
      expect(out).not.toContain("@@CRM_COLLECTIONS@@")
      expect(out).not.toContain("@@ROOT_COLLECTIONS@@")
    })
  })
})
