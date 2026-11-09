import { type NextRequest } from "next/server"


import { closedTarget, unknownTarget } from "@/lib/account-ledger"
import { validateApiKey, apiError, internalError } from "@/lib/api-auth"
import { getServerDb } from "@/lib/backend/server-db"
import { z } from "@/lib/zod"
import { apiCreateTransactionSchema } from "@/types/schemas"

import type { Transaction } from "@/types"

const bulkSchema = z.object({
  transactions: z.array(apiCreateTransactionSchema).min(1).max(100),
})

export async function POST(request: NextRequest) {
  const userId = await validateApiKey(request)
  if (!userId) return apiError("UNAUTHORIZED", "Invalid or missing API key", 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON body", 400)
  }

  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid bulk transaction data", 400, parsed.error.issues)
  }

  const db = getServerDb()
  // Checked before the first write: one closed account refuses the whole request.
  try {
    const accounts = await db.getAccounts(userId)
    for (const [i, row] of parsed.data.transactions.entries()) {
      const targets = [row.accountId, row.transferToAccountId]
      const unknown = unknownTarget(accounts, targets)
      if (unknown) return apiError("UNKNOWN_ACCOUNT", `Row ${i}: account "${unknown}" does not exist.`, 422)
      const closed = closedTarget(accounts, targets)
      if (closed) return apiError("ACCOUNT_CLOSED", `Row ${i}: account "${closed.name}" is closed.`, 409)
    }
  } catch (err) {
    return internalError(err)
  }

  const created: Transaction[] = []
  const errors: { index: number; message: string }[] = []

  const BATCH_SIZE = 50
  for (let start = 0; start < parsed.data.transactions.length; start += BATCH_SIZE) {
    const batch = parsed.data.transactions.slice(start, start + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map((input, j) => db.createTransaction(userId, input).then(
        (tx) => ({ index: start + j, tx }),
      ))
    )
    for (const result of results) {
      if (result.status === "fulfilled") {
        created.push(result.value.tx)
      } else {
        const idx = results.indexOf(result)
        console.error("[api] bulk row failed", start + idx, result.reason)
        errors.push({ index: start + idx, message: "Could not create this transaction." })
      }
    }
  }

  return Response.json({ created, errors }, { status: 201 })
}
