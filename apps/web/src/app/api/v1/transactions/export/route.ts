import { type NextRequest } from "next/server"

import { apiError, validateApiKey, internalError } from "@/lib/api-auth"
import { getServerDb } from "@/lib/backend/server-db"
import { buildTransactionsCsv, transactionsCsvFileName } from "@/lib/transactions-export"
import { apiTransactionsExportSchema } from "@/types/schemas"

export async function GET(request: NextRequest) {
  const userId = await validateApiKey(request)
  if (!userId) return apiError("UNAUTHORIZED", "Invalid or missing API key", 401)

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = apiTransactionsExportSchema.safeParse(params)
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid query parameters", 400, parsed.error.issues)
  }
  const { dateFrom, dateTo, expandSplits } = parsed.data

  try {
    const db = getServerDb()
    const [txResult, accounts] = await Promise.all([
      db.getTransactions(userId, { dateFrom, dateTo }),
      db.getAccounts(userId),
    ])

    const csv = buildTransactionsCsv({
      transactions: txResult.data,
      accounts,
      dateFrom,
      dateTo,
      expandSplits,
    })

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${transactionsCsvFileName(dateFrom, dateTo, expandSplits)}"`,
      },
    })
  } catch (err) {
    return internalError(err)
  }
}
