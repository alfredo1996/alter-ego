/**
 * Server-side Firebase access using firebase-admin SDK.
 *
 * Why this exists: Next.js API routes run server-side with no Firebase Auth
 * session, so the browser-oriented Web SDK adapter (firebase.ts) gets
 * PERMISSION_DENIED on every rules-protected write. Admin SDK bypasses
 * rules and is the correct server-side primitive.
 *
 * Scope: the app's own server functions (API keys, the audit trail) plus finance's, which
 * the package builds from this app's Firestore getter.
 */

import { createHash } from "node:crypto"

import { createFinanceAdmin } from "@alter-ego/finance/adapter-admin"
import { FieldValue } from "firebase-admin/firestore"

import { getAdminFirestore } from "@/lib/firebase-admin-client"

function userCol(userId: string, name: string) {
  return getAdminFirestore().collection(`users/${userId}/${name}`)
}

const now = () => FieldValue.serverTimestamp()

// ─── API keys (users/{uid}/api_keys + top-level api_keys_index) ─────────────
// The server is the only writer (#342): the visible doc and the index row go in
// one batch, the index id is the key hash, and a key is valid only while both exist.

export async function createApiKey(userId: string): Promise<{ key: string; id: string }> {
  const key = `ak_${crypto.randomUUID().replace(/-/g, "")}`
  const keyHash = createHash("sha256").update(key).digest("hex")
  const db = getAdminFirestore()
  const ref = userCol(userId, "api_keys").doc()
  const batch = db.batch()
  batch.create(ref, { userId, keyHash, prefix: key.slice(0, 7) + "...", createdAt: now() })
  batch.create(db.collection("api_keys_index").doc(keyHash), {
    userId,
    keyHash,
    apiKeyDocId: ref.id,
    createdAt: now(),
  })
  await batch.commit()
  return { key, id: ref.id }
}

/**
 * Removes the visible doc and its index rows atomically; another user's key id
 * is a no-op. Keys made before #342 have a random-id index row, so match by
 * userId + keyHash as well as by doc id.
 */
export async function deleteApiKey(userId: string, keyId: string): Promise<void> {
  const db = getAdminFirestore()
  const ref = userCol(userId, "api_keys").doc(keyId)
  const snap = await ref.get()
  if (!snap.exists) return
  const keyHash = snap.data()?.keyHash as string
  const legacy = await db.collection("api_keys_index").where("keyHash", "==", keyHash).get()
  const batch = db.batch()
  batch.delete(ref)
  batch.delete(db.collection("api_keys_index").doc(keyHash))
  for (const d of legacy.docs) if (d.data().userId === userId) batch.delete(d.ref)
  await batch.commit()
}

export async function validateApiKey(keyHash: string): Promise<string | null> {
  const db = getAdminFirestore()
  const index = db.collection("api_keys_index")
  let idx = (await index.doc(keyHash).get()).data()
  // Keys made before #342 were indexed under a random id: fall back to a lookup by hash.
  if (!idx) idx = (await index.where("keyHash", "==", keyHash).limit(1).get()).docs[0]?.data()
  if (!idx?.userId || !idx.apiKeyDocId) return null
  const visible = await userCol(idx.userId as string, "api_keys").doc(idx.apiKeyDocId as string).get()
  return visible.data()?.keyHash === keyHash ? (idx.userId as string) : null
}

export async function addAuditEntry(
  userId: string,
  entry: {
    tool: string
    params: unknown
    result: "ok" | "error"
    errorMessage?: string
    documentIds?: string[]
    clientId: string
    preview?: boolean
  },
): Promise<void> {
  await userCol(userId, "mcp_audit").add({
    tool: entry.tool,
    params: JSON.parse(JSON.stringify(entry.params ?? null)),
    result: entry.result,
    errorMessage: entry.errorMessage ?? null,
    documentIds: entry.documentIds ?? [],
    clientId: entry.clientId,
    ...(entry.preview ? { preview: true } : {}),
    createdAt: now(),
  })
}

/** Everything the server reaches the database through: the app's functions plus finance's. */
export const firebaseAdmin = {
  createApiKey,
  deleteApiKey,
  validateApiKey,
  addAuditEntry,
  ...createFinanceAdmin(() => getAdminFirestore()),
}
