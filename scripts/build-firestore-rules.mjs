/**
 * Writes firestore.rules, the file Firebase deploys, from firestore/base.rules and the finance
 * package's two fragments.
 *
 * Rules have no import mechanism, so this is a text splice at two markers rather than a
 * concatenation of whole files. Each fragment goes in as written:
 *  - packages/modules/finance/src/finance.rules, at `// @@CRM_COLLECTIONS@@` inside
 *    `match /users/{userId}`: finance's collections and the nine validators they call
 *    (isValidAccountType to isValidCategoryGroup, declared as functions in that block);
 *  - packages/modules/finance/src/finance-root.rules, at `// @@ROOT_COLLECTIONS@@` at the top
 *    level: the read-only system categories (`match /categories`), which the host seeds.
 * A host vendoring the package splices the same two files at its own two markers; nothing
 * else of finance stays in base.rules. The build fails when a marker or a fragment is missing.
 * No comment goes into base.rules about this: it would be copied into the output.
 */
import { readFileSync, writeFileSync } from "node:fs"

const USERS_MARKER = "      // @@CRM_COLLECTIONS@@"
const ROOT_MARKER = "    // @@ROOT_COLLECTIONS@@"

/**
 * @param {{ base: string, finance: string, financeRoot: string }} fragments
 * @returns {string}
 */
export function buildRules({ base, finance, financeRoot }) {
  for (const marker of [USERS_MARKER, ROOT_MARKER]) {
    if (!base.includes(marker)) throw new Error(`base.rules is missing the ${marker.trim()} marker`)
  }
  if (!finance.trim()) throw new Error("finance.rules is empty")
  if (!financeRoot.trim()) throw new Error("finance-root.rules is empty")
  // functions: a string replacement would expand $-sequences
  return base.replace(USERS_MARKER, () => finance.trimEnd()).replace(ROOT_MARKER, () => financeRoot.trimEnd())
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(
    "firestore.rules",
    buildRules({
      base: readFileSync("firestore/base.rules", "utf8"),
      finance: readFileSync("packages/modules/finance/src/finance.rules", "utf8"),
      financeRoot: readFileSync("packages/modules/finance/src/finance-root.rules", "utf8"),
    }),
  )
  console.log("firestore.rules written")
}
