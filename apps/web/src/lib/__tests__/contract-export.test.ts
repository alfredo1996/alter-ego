/**
 * The finance cases of the adapter contract live in the package and reach the app only through its
 * "./contract" export, so a host app runs the same cases against its own composed adapter. The app's
 * adapter-contract.ts is the wrapper that supplies the adapter; a case written back into it would
 * run for this app alone.
 */
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const wrapper = readFileSync("src/lib/backend/__tests__/adapter-contract.ts", "utf8")
const pkg = JSON.parse(readFileSync("../../packages/modules/finance/package.json", "utf8"))

describe("the finance contract export", () => {
  it("is exported by the package", () => {
    expect(pkg.exports["./contract"]).toBe("./src/__tests__/contract.ts")
  })

  it("is what adapter-contract.ts runs, with no case of its own", () => {
    expect(wrapper).toContain('from "@alter-ego/finance/contract"')
    expect(wrapper).toContain("describeFinanceContract(")
    expect(wrapper.match(/^\s*it\(/gm)).toBeNull()
  })
})
