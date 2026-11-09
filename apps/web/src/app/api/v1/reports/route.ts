import { type NextRequest } from "next/server"

import { apiError, validateApiKey, internalError } from "@/lib/api-auth"
import { getServerDb } from "@/lib/backend/server-db"
import { apiReportsQuerySchema, type reportPeriodShortcutSchema } from "@/types/schemas"

import type { z } from "zod"

type PeriodShortcut = z.infer<typeof reportPeriodShortcutSchema>

function resolvePeriod(period: PeriodShortcut, now = new Date()): { from: Date; to: Date } {
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (period) {
    case "this-month":
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59, 999) }
    case "last-month":
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0, 23, 59, 59, 999) }
    case "last-3-months":
      return { from: new Date(y, m - 2, 1), to: new Date(y, m + 1, 0, 23, 59, 59, 999) }
    case "last-6-months":
      return { from: new Date(y, m - 5, 1), to: new Date(y, m + 1, 0, 23, 59, 59, 999) }
    case "this-year":
      return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59, 999) }
    case "last-12-months":
      return { from: new Date(y, m - 11, 1), to: new Date(y, m + 1, 0, 23, 59, 59, 999) }
  }
}

export async function GET(request: NextRequest) {
  const userId = await validateApiKey(request)
  if (!userId) return apiError("UNAUTHORIZED", "Invalid or missing API key", 401)

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = apiReportsQuerySchema.safeParse(params)
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid query parameters", 400, parsed.error.issues)
  }
  const { period, dateFrom, dateTo, accountIds, categoryIds } = parsed.data

  const range = period ? resolvePeriod(period) : { from: dateFrom!, to: dateTo! }
  const filters =
    (accountIds && accountIds.length) || (categoryIds && categoryIds.length)
      ? { accountIds, categoryIds }
      : undefined

  try {
    const data = await getServerDb().getReportData(userId, range, filters)
    return Response.json({
      dateRange: { from: range.from.toISOString(), to: range.to.toISOString() },
      ...data,
    })
  } catch (err) {
    return internalError(err)
  }
}
