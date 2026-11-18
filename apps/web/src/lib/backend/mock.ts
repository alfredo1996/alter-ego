import { clearMockFinance, mockFinance, mockId } from "@alter-ego/finance/adapter-mock"

import type {
  BackendAdapter,
  AuthAdapter,
  DatabaseAdapter,
  AIAdapter,
  AuditAdapter,
} from "./types"
import type { McpAuditEntry, User, ApiKey } from "@/types"

let mockUser: User | null = null
let authCallbacks: Array<(user: User | null) => void> = []

const apiKeys: Map<string, ApiKey> = new Map()
const auditEntries: Map<string, McpAuditEntry[]> = new Map()

function notifyAuthListeners() {
  authCallbacks.forEach((cb) => cb(mockUser))
}

const mockAuth: AuthAdapter = {
  async signIn(email: string, _password: string): Promise<User> {
    mockUser = {
      id: "mock-user-1",
      email,
      displayName: email.split("@")[0],
      photoURL: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    notifyAuthListeners()
    return mockUser
  },

  async signUp(email: string, _password: string, displayName: string): Promise<User> {
    mockUser = {
      id: "mock-user-1",
      email,
      displayName,
      photoURL: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    notifyAuthListeners()
    return mockUser
  },

  async signOut(): Promise<void> {
    mockUser = null
    notifyAuthListeners()
  },

  async getCurrentUser(): Promise<User | null> {
    return mockUser
  },

  // ponytail: not a real signed token — the mock backend has no signing key, and
  // the server rejects it. OAuth against the mock backend is not a supported combo.
  async getIdToken(): Promise<string | null> {
    return mockUser ? `mock-id-token:${mockUser.id}` : null
  },

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    authCallbacks.push(callback)
    callback(mockUser)
    return () => {
      authCallbacks = authCallbacks.filter((cb) => cb !== callback)
    }
  },

  async updateProfile(input: { displayName?: string; email?: string }): Promise<void> {
    if (!mockUser) throw new Error("Not signed in")
    mockUser = {
      ...mockUser,
      displayName: input.displayName !== undefined ? input.displayName : mockUser.displayName,
      email: input.email !== undefined ? input.email : mockUser.email,
      updatedAt: new Date(),
    }
    notifyAuthListeners()
  },
}

/** The finance mock plus what the app adds: API keys and the audit trail. */
const mockDb: DatabaseAdapter & AuditAdapter & { validateApiKey(keyHash: string): Promise<string | null> } = {
  ...mockFinance,

  // API keys
  async createApiKey(userId: string): Promise<{ key: string; id: string }> {
    const id = mockId()
    const rawKey = `ak_${id}_${Math.random().toString(36).slice(2, 14)}`
    const prefix = rawKey.slice(0, 7) + "..."
    // Hash the key for storage (matches what api-auth.ts sends to validateApiKey)
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawKey))
    const keyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    const apiKey: ApiKey = {
      id,
      userId,
      keyHash,
      prefix,
      createdAt: new Date(),
    }
    apiKeys.set(id, apiKey)
    return { key: rawKey, id }
  },

  async validateApiKey(keyHash: string): Promise<string | null> {
    for (const ak of apiKeys.values()) {
      if (ak.keyHash === keyHash) return ak.userId
    }
    return null
  },

  async deleteApiKey(userId: string, keyId: string): Promise<void> {
    const ak = apiKeys.get(keyId)
    if (ak && ak.userId !== userId) return
    apiKeys.delete(keyId)
  },

  async getApiKeys(userId: string): Promise<Pick<ApiKey, "id" | "prefix" | "createdAt">[]> {
    return Array.from(apiKeys.values())
      .filter((ak) => ak.userId === userId)
      .map(({ id, prefix, createdAt }) => ({ id, prefix, createdAt }))
  },

  // ── Server-only (see AuditAdapter) ─────────────────────

  async addAuditEntry(userId: string, entry: McpAuditEntry): Promise<void> {
    const forUser = auditEntries.get(userId) ?? []
    forUser.push(entry)
    auditEntries.set(userId, forUser)
  },
}

const mockAi: AIAdapter = {
  async chat(_userId: string, _message: string): Promise<string> {
    return "AI features are not available in mock mode."
  },

  async categorize(_description: string) {
    return null
  },
}

export function __resetMockState() {
  clearMockFinance()
  apiKeys.clear()
  authCallbacks = []
  mockUser = null
}

/**
 * Opt-in latency, for e2e only. The mock answers in a microtask, so a page's
 * loading state never lasts long enough to assert on. A spec sets
 * `window.__MOCK_LATENCY_MS__` and every db call then waits that long first.
 * It is read on each call, so a spec can seed its data at full speed and slow
 * down afterwards. A runtime global, not a NEXT_PUBLIC_ variable: those are
 * inlined when the dev server compiles, and all specs share that one server.
 * Unset, which is always the case outside e2e, it changes nothing.
 */
function withLatency<T extends object>(db: T): T {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver)
      const ms = (globalThis as { __MOCK_LATENCY_MS__?: number }).__MOCK_LATENCY_MS__
      if (!ms || typeof value !== "function") return value
      return async (...args: unknown[]) => {
        await new Promise((resolve) => setTimeout(resolve, ms))
        return value.apply(target, args)
      }
    },
  })
}

export function createMockAdapter(): BackendAdapter {
  return {
    auth: mockAuth,
    db: withLatency(mockDb),
    ai: mockAi,
  }
}
