/**
 * Returns the server-side database accessor.
 *
 * When NEXT_PUBLIC_BACKEND=firebase, this is the Admin SDK module (bypasses
 * Firestore rules). When NEXT_PUBLIC_BACKEND=mock, it's the mock adapter's db.
 *
 * Use this from Next.js API routes only. Browser code should keep using
 * getBackend() from "./index".
 */

import { getBackend } from "@/lib/backend"
import * as firebaseAdmin from "@/lib/backend/firebase-admin"
import { env } from "@/lib/env"

import type { AuditAdapter, DatabaseAdapter } from "./types"
import type { Account } from "@/types"


/**
 * Common subset of DatabaseAdapter methods exposed by both the mock adapter
 * and the admin-SDK module. REST API routes target this surface so they
 * don't care which backend is wired in.
 */
export type ServerDb = AuditAdapter & {
    /** Server-only (#342): the key is valid only while its visible document exists. */
    validateApiKey(keyHash: string): Promise<string | null>
    /** Close or reopen only (#312): the Admin SDK bypasses the rules, so it takes no wider write. */
    updateAccount(userId: string, accountId: string, input: { isArchived: boolean }): Promise<Account>
  } &
  Pick<
    DatabaseAdapter,
    | "getAccounts"
    | "getAccount"
    | "createAccount"
    | "getBudgets"
    | "getTags"
    | "getRecurringTransactions"
    | "getCategories"
    | "getTransactions"
    | "getTransaction"
    | "getMonthlyTotals"
    | "createTransaction"
    | "updateTransaction"
    | "deleteTransaction"
    | "createApiKey"
    | "deleteApiKey"
    | "getReportData"
  >

export function getServerDb(): ServerDb {
  if (env.NEXT_PUBLIC_BACKEND === "firebase") {
    return firebaseAdmin as unknown as ServerDb
  }
  // The mock db does implement the server-only halves — BackendAdapter just types
  // `db` as DatabaseAdapter, which deliberately excludes them so the client-side
  // Firebase adapter is not asked for collections its rules deny.
  return getBackend().db as unknown as ServerDb
}
