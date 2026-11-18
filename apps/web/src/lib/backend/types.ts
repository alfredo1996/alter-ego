import type {
  McpAuditEntry,
  User,
  ApiKey,
} from "@/types"
import type { FinanceAdapter } from "@alter-ego/finance/adapter"


export interface AuthAdapter {
  signIn(email: string, password: string): Promise<User>
  signUp(email: string, password: string, displayName: string): Promise<User>
  signOut(): Promise<void>
  getCurrentUser(): Promise<User | null>
  onAuthStateChanged(callback: (user: User | null) => void): () => void
  updateProfile(input: { displayName?: string; email?: string }): Promise<void>
  /**
   * A signed identity token for the current session, or null when signed out.
   *
   * Used by the OAuth consent page to prove to the server who is approving —
   * the alternative is reaching past the adapter into the Firebase SDK.
   */
  getIdToken(): Promise<string | null>
}

/** The API-key surface: not finance, so it stays with the app. */
export interface ApiKeysAdapter {
  createApiKey(userId: string): Promise<{ key: string; id: string }>
  deleteApiKey(userId: string, keyId: string): Promise<void>
  getApiKeys(userId: string): Promise<Pick<ApiKey, "id" | "prefix" | "createdAt">[]>
}

/** Finance's database surface plus the API keys. */
export interface AccountingAdapter extends FinanceAdapter, ApiKeysAdapter {}

export interface AIAdapter {
  chat(userId: string, message: string, context?: Record<string, unknown>): Promise<string>
  categorize(description: string): Promise<{ categoryId: string; confidence: number } | null>
}

export interface BackendAdapter {
  auth: AuthAdapter
  db: DatabaseAdapter
  ai: AIAdapter
}

/** The accounting adapter, the whole of a deployment's database surface. */
export type DatabaseAdapter = AccountingAdapter

/**
 * Server-only surfaces. These are deliberately NOT on DatabaseAdapter: the
 * `mcp_audit` collection is `allow read, write: if false` in
 * firestore.rules, so the client SDK could never implement them honestly. They
 * are reached through the Admin SDK, which bypasses rules — which is exactly why
 * they must go through an interface rather than a direct firebase-admin import.
 */
export interface AuditAdapter {
  /** Records one MCP tool call. Shared by both products' tools. */
  addAuditEntry(userId: string, entry: McpAuditEntry): Promise<void>
}
