// What the app itself needs (the signed-in user, API keys, the MCP audit trail); everything finance
// defines is re-exported, so `@/types` imports keep working.
export * from "@alter-ego/finance/types"

export interface User {
  id: string
  email: string
  displayName: string | null
  photoURL: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ApiKey {
  id: string
  userId: string
  keyHash: string
  prefix: string
  createdAt: Date
}

// The MCP audit trail entry is defined with the tools that write it.
export type { McpAuditEntry } from "@alter-ego/finance/mcp"
