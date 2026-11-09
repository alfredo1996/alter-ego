/**
 * The rules the emulator suite loads. Test-only.
 *
 * Production admits one uid (`isAllowedUser` in firestore/base.rules). The suite
 * signs up dozens of throwaway users, each with a random uid, so the shared
 * emulator project runs the same rules with that one function opened up
 * (`testRules`). `firestore-rules-owner.test.ts` loads `productionRules` into a
 * project of its own and proves the allowlist.
 */
import { readFileSync } from "node:fs"

const ALLOWLIST = /(function isAllowedUser\(\) \{\s*return )[^;]+;/

export const productionRules = (): string => readFileSync("../../firestore.rules", "utf8")

/** Production rules with the allowlist open to every signed-in uid. */
export function testRules(rules = productionRules()): string {
  if (!ALLOWLIST.test(rules)) throw new Error("firestore.rules has no isAllowedUser() to open up")
  return rules.replace(ALLOWLIST, "$1true;")
}

/** Replaces a project's Firestore rules in the emulator (no file, no restart). */
export async function loadRules(firestoreHost: string, projectId: string, content: string): Promise<void> {
  const res = await fetch(`http://${firestoreHost}/emulator/v1/projects/${projectId}:securityRules`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: { files: [{ name: "firestore.rules", content }] } }),
  })
  if (!res.ok) throw new Error(`Cannot load rules into ${projectId}: ${res.status} ${await res.text()}`)
}
