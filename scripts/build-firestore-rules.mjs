/**
 * Writes firestore.rules, the file Firebase deploys, from firestore/base.rules.
 *
 * base.rules keeps a marker line where a deployment that adds collections of its
 * own splices them in (the company repository's rules, when both run on one
 * project). This repository has none, so the marker and the blank line before
 * it are dropped. A collection with no matching rule is denied by default.
 */
import { readFileSync, writeFileSync } from "node:fs"

const MARKER = "      // @@CRM_COLLECTIONS@@"

/**
 * @param {{ base: string }} fragments
 * @returns {string}
 */
export function buildRules({ base }) {
  if (!base.includes(MARKER)) {
    throw new Error(`base.rules is missing the ${MARKER.trim()} marker`)
  }
  return base.replace(`\n\n${MARKER}`, "")
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync("firestore.rules", buildRules({ base: readFileSync("firestore/base.rules", "utf8") }))
  console.log("firestore.rules written")
}
