import { type NextRequest } from "next/server"

import { validateApiKey, apiError, internalError } from "@/lib/api-auth"
import { getServerDb } from "@/lib/backend/server-db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await validateApiKey(request)
  if (!userId) return apiError("UNAUTHORIZED", "Invalid or missing API key", 401)

  const { id } = await params

  try {
    const db = getServerDb()
    const transaction = await db.getTransaction(userId, id)
    if (!transaction) {
      return apiError("NOT_FOUND", `Transaction ${id} not found`, 404)
    }
    return Response.json(transaction)
  } catch (err) {
    return internalError(err)
  }
}
