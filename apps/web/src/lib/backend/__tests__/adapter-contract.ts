import { describeFinanceContract } from "@alter-ego/finance/contract"
import { describe, beforeAll, afterAll } from "vitest"

import type { DatabaseAdapter } from "../types"

export interface ContractSetup {
  (): Promise<{
    db: DatabaseAdapter
    userId: string
    otherUserId: string
    /** Firebase only: the daily balance snapshots v0.9.0 and older stored, still in production. */
    legacyBalanceSnapshots?: { seed: () => Promise<void>; count: () => Promise<number> }
    /** Firebase only: stores a net-worth snapshot dated `date` (a local day) worth `netWorth`. */
    seedNetWorthSnapshot?: (date: Date, netWorth: number) => Promise<void>
    cleanup: () => Promise<void>
  }>
}

/**
 * Every case is finance's, so every case lives in the package (packages/modules/finance/src/__tests__/
 * contract.ts) and runs here against this app's composed adapter. A case for something that is not
 * finance's goes here.
 */
export function describeAdapterContract(name: string, setup: ContractSetup) {
  describe(`${name} — adapter contract`, () => {
    let result: Awaited<ReturnType<ContractSetup>>

    beforeAll(async () => {
      result = await setup()
    })

    afterAll(async () => {
      await result?.cleanup?.()
    })

    describeFinanceContract(() => result)
  })
}
