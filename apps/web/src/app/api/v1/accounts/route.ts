import { type NextRequest } from "next/server"

import { validateApiKey, apiError, internalError } from "@/lib/api-auth"
import { getServerDb } from "@/lib/backend/server-db"

export async function GET(request: NextRequest) {
  const userId = await validateApiKey(request)
  if (!userId) return apiError("UNAUTHORIZED", "Invalid or missing API key", 401)

  try {
    const data = await getServerDb().getAccounts(userId)
    return Response.json({ data })
  } catch (err) {
    return internalError(err)
  }
}
