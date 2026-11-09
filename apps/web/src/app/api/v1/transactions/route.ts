import { type NextRequest } from "next/server"

import { closedTarget, unknownTarget } from "@/lib/account-ledger"
import { validateApiKey, apiError, internalError } from "@/lib/api-auth"
import { getServerDb } from "@/lib/backend/server-db"
import { apiCreateTransactionSchema, apiTransactionFiltersSchema } from "@/types/schemas"

export async function GET(request: NextRequest) {
  const userId = await validateApiKey(request)
  if (!userId) return apiError("UNAUTHORIZED", "Invalid or missing API key", 401)

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = apiTransactionFiltersSchema.safeParse(params)
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid query parameters", 400, parsed.error.issues)
  }

  const { limit, offset, ...filters } = parsed.data

  try {
    const db = getServerDb()
    const result = await db.getTransactions(userId, { ...filters, limit, offset })
    return Response.json({ data: result.data, total: result.total })
  } catch (err) {
    return internalError(err)
  }
}

export async function POST(request: NextRequest) {
  const userId = await validateApiKey(request)
  if (!userId) return apiError("UNAUTHORIZED", "Invalid or missing API key", 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON body", 400)
  }

  const parsed = apiCreateTransactionSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid transaction data", 400, parsed.error.issues)
  }

  try {
    const db = getServerDb()
    const accounts = await db.getAccounts(userId)
    const targets = [parsed.data.accountId, parsed.data.transferToAccountId]
    const unknown = unknownTarget(accounts, targets)
    if (unknown) return apiError("UNKNOWN_ACCOUNT", `Account "${unknown}" does not exist.`, 422)
    const closed = closedTarget(accounts, targets)
    if (closed) return apiError("ACCOUNT_CLOSED", `Account "${closed.name}" is closed.`, 409)
    const transaction = await db.createTransaction(userId, parsed.data)
    return Response.json(transaction, { status: 201 })
  } catch (err) {
    return internalError(err)
  }
}
