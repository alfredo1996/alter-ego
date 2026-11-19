/**
 * The finance package carries its Firestore indexes (a host app deploys them with its own); the root
 * firestore.indexes.json is the file this app's firebase.json deploys. They stay equal, byte for byte,
 * so the drift shows here rather than as a query that fails with "requires an index" in production.
 */
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const root = readFileSync("../../firestore.indexes.json", "utf8")
const pkg = readFileSync("../../packages/modules/finance/src/firestore.indexes.json", "utf8")

describe("firestore indexes", () => {
  it("the root file equals the finance package's", () => {
    expect(root).toBe(pkg)
  })

  it("both are valid and declare at least one index", () => {
    expect(JSON.parse(pkg).indexes.length).toBeGreaterThan(0)
  })
})
