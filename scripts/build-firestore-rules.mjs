/**
 * Writes firestore.rules, the file Firebase deploys, from firestore/base.rules and the finance
 * package's collections (packages/modules/finance/src/finance.rules).
 *
 * Rules have no import mechanism and finance's collections live *inside*
 * `match /users/{userId}`, so this is a text splice at a marker rather than a
 * concatenation of whole files. The fragment goes in as written: its first and last
 * lines are the first and last lines of the collections.
 *
 * What stays in base.rules, because it sits at the root and the splice lands inside
 * `match /users/{userId}`: the system categories (`match /categories`, read-only), which
 * are finance's, and the finance validators (isValidAccountType to isValidCategoryGroup).
 * Moving either into the fragment would move it in the built file, and the built file
 * must not change when rules move between files. A host that vendors the fragment needs
 * both in its own base.rules. No comment goes into base.rules for this: it would be
 * copied into the output.
 */
import { readFileSync, writeFileSync } from "node:fs"

const MARKER = "      // @@CRM_COLLECTIONS@@"

/**
 * @param {{ base: string, finance: string }} fragments
 * @returns {string}
 */
export function buildRules({ base, finance }) {
  if (!base.includes(MARKER)) {
    throw new Error(`base.rules is missing the ${MARKER.trim()} marker`)
  }
  return base.replace(MARKER, () => finance.trimEnd()) // function: a string would expand $-sequences
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(
    "firestore.rules",
    buildRules({
      base: readFileSync("firestore/base.rules", "utf8"),
      finance: readFileSync("packages/modules/finance/src/finance.rules", "utf8"),
    }),
  )
  console.log("firestore.rules written")
}
