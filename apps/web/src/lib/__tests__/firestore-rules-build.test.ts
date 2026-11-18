/**
 * firestore.rules is generated from firestore/base.rules and the finance package's
 * finance.rules, and it is the file
 * Firebase actually deploys. These assertions are the drift guard: edit the
 * fragment without rebuilding and this fails here rather than at deploy time,
 * when the mismatch is a security change nobody reviewed.
 */
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { buildRules } from "../../../../../scripts/build-firestore-rules.mjs"

const base = readFileSync("../../firestore/base.rules", "utf8")
const finance = readFileSync("../../packages/modules/finance/src/finance.rules", "utf8")

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
    expect(buildRules({ base, finance })).toBe(readFileSync("../../firestore.rules", "utf8"))
  })

  it("takes the finance collections from the package fragment, so editing it changes the output", () => {
    const edited = buildRules({ base, finance: finance.replace("match /accounts/", "match /accounts_x/") })
    expect(edited).toContain("match /accounts_x/")
    expect(edited).not.toBe(buildRules({ base, finance }))
    expect(base).not.toContain("match /accounts/")
  })

  it("refuses a base with no marker", () => {
    expect(() => buildRules({ base: "rules_version = '2';", finance })).toThrow(/marker/)
  })

  it("puts the fragment where the marker was, and nothing else moves", () => {
    expect(buildRules({ base: "head\n\n      // @@CRM_COLLECTIONS@@\n\ntail\n", finance: "      // frag $& $1\n\n" })).toBe(
      "head\n\n      // frag $& $1\n\ntail\n",
    )
  })

  describe("the build", () => {
    const out = buildRules({ base, finance })

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
    })
  })
})
