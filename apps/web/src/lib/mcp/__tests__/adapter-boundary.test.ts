/**
 * CLAUDE.md: "NEVER import Firebase directly in feature code." The MCP tools did,
 * in four places, which quietly made the whole MCP server Firebase-only — running
 * it on any other backend reached for the Admin SDK regardless.
 *
 * This is the guard, not a re-test of the routing: it fails the moment a tool file
 * reaches past the adapter again.
 */
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

// The tools themselves live in @alter-ego/finance, which has its own boundary test (no "@/" import at
// all, so no firebase-admin); what is left here is the two places that register them.
const sourceFiles = ["src/app/api/mcp/route.ts", "scripts/mcp-stdio.ts"]

describe("MCP tools reach the database through the adapter", () => {
  it.each(sourceFiles)("%s does not import firebase-admin", (file) => {
    expect(readFileSync(file, "utf8")).not.toContain("@/lib/backend/firebase-admin")
  })

  // The Firebase client SDK would be worse than the Admin one: capacity and
  // mcp_audit are `allow read, write: if false`, so it cannot work at all.
  it.each(sourceFiles)("%s does not import the Firebase client either", (file) => {
    const src = readFileSync(file, "utf8")
    expect(src).not.toContain("@/lib/backend/firebase\"")
    expect(src).not.toContain("firebase/firestore")
  })
})
