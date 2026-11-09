/**
 * firestore.rules is generated from firestore/base.rules, and it is the file
 * Firebase actually deploys. These assertions are the drift guard: edit the
 * fragment without rebuilding and this fails here rather than at deploy time,
 * when the mismatch is a security change nobody reviewed.
 */
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { buildRules } from "../../../../../scripts/build-firestore-rules.mjs"

const base = readFileSync("../../firestore/base.rules", "utf8")

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
    expect(buildRules({ base })).toBe(readFileSync("../../firestore.rules", "utf8"))
  })

  it("refuses a base with no marker", () => {
    expect(() => buildRules({ base: "rules_version = '2';" })).toThrow(/marker/)
  })

  it("drops the marker and the blank line before it", () => {
    expect(buildRules({ base: "head\n\n      // @@CRM_COLLECTIONS@@\ntail\n" })).toBe("head\ntail\n")
  })

  describe("the build", () => {
    const out = buildRules({ base })

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
