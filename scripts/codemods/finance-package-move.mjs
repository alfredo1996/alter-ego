/**
 * One-off codemod for "personal finance moves into @alter-ego/finance". It is committed
 * so a reviewer can re-run it on the parent commit and diff its output with `git diff -M`.
 *
 *   node scripts/codemods/finance-package-move.mjs
 *
 * 1. `git mv` every finance file from apps/web/src to packages/modules/finance/src.
 * 2. Copy the three shell helpers finance also needs (the app keeps its own use of them).
 * 3. Rewrite imports: inside the package `@/x` becomes a relative path, and `@/lib/backend`,
 *    `@/hooks/use-auth` point at `host` (so call sites do not change); in the app (and its
 *    scripts, tests, configs) an import of a moved file becomes `@alter-ego/finance/...`.
 *
 * `@/types` and `@/types/schemas` in the app are left alone: the app keeps barrels there.
 */
import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const WEB = join(ROOT, "apps/web")
const SRC = join(WEB, "src")
const PKG = join(ROOT, "packages/modules/finance/src")

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = join(d, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
const all = walk(SRC).map((p) => relative(SRC, p))

// ── What moves ─────────────────────────────────────────────────────────────────────────────────
const COMPONENT_DIRS = ["accounts", "budgets", "categories", "charts", "dashboard", "recurring", "reports", "savings-goals", "transactions"]
const HOOKS_STAY = ["use-api-keys.ts", "use-auth.ts", "use-chat.ts", "create-crud-hooks.ts"]
const LIB_MOVE = [
  "account-ledger", "amortization", "mortgage", "balance-series", "loan-buckets", "splits", "monthly-totals", "merchants",
  "budgets", "rollover", "net-worth", "chart-scale", "subscription-detector", "recurring-summary", "categories", "category-groups",
  "options", "features", "full-export", "transactions-export", "xlsx", "csv-import", "money-manager-import", "import-dedup",
  "selection-summary", "export",
]
// Tests that move with their code. Every other test stays in the app: those need the mock backend or the app's routes.
const TESTS_MOVE = new Set([
  ...["account-ledger", "amortization", "balance-series", "budget-alerts", "budgets", "categories-merge", "category-groups", "chart-scale",
    "csv-import", "full-export", "import-dedup", "loan-buckets", "merchants", "money-manager-import", "mortgage", "net-worth", "options",
    "recurring-summary", "rollover", "selection-summary", "splits", "subscription-detector", "transaction-schemas", "transactions-export",
    "use-reports-utils", "xlsx"].map((n) => `lib/__tests__/${n}.test.ts`),
  "lib/__tests__/helpers/xlsx-fixture.ts",
  "hooks/__tests__/use-open-from-query.test.tsx", "hooks/__tests__/use-row-selection.test.ts",
  "components/__tests__/state-not-faded.test.tsx", "components/__tests__/loading-states.test.tsx",
])
// Shell files finance also uses: copied, the app keeps its own.
const COPIES = ["components/confirm-delete-dialog.tsx", "hooks/create-crud-hooks.ts", "lib/zod.ts"]

function dest(f) {
  let m
  if ((m = f.match(/^components\/([^/]+)\//)) && COMPONENT_DIRS.includes(m[1])) return f
  if (f === "components/pull-to-refresh.tsx") return f
  if (f.startsWith("components/__tests__/") || f.startsWith("lib/__tests__/") || f.startsWith("hooks/__tests__/")) return TESTS_MOVE.has(f) ? f : null
  if (f.startsWith("hooks/")) return HOOKS_STAY.includes(f.slice(6)) ? null : f
  if ((m = f.match(/^lib\/([^/]+)\.ts$/)) && LIB_MOVE.includes(m[1])) return f
  if (f === "stores/import-store.ts" || f === "stores/settings-store.ts") return f
  if (f === "types/index.ts") return "types.ts"
  if (f === "types/schemas.ts") return "schemas.ts"
  return null
}
const moves = new Map(all.map((f) => [f, dest(f)]).filter(([, d]) => d))

// A test moves only when everything it imports moves too (or is a copied helper). One that reaches the
// app's mock backend, its auth hook or any other app file stays in the app and imports the package
// instead: it needs the host the app provides, and the package has no backend of its own yet.
const EXTS = [".ts", ".tsx", "/index.ts", "/index.tsx"]
const OLD = new Set(all.map((f) => join(SRC, f)))
const resolveFile = (base) => EXTS.map((e) => base + e).find((p) => OLD.has(p)) ?? (OLD.has(base) ? base : undefined)
const rx = /(\b(?:from|import|mock|doMock|importActual|importOriginal|requireActual)\s*\(?\s*(?:<[^>]*>\s*\(\s*)?)(["'])([^"'\n]+)\2/g
const isTest = (f) => f.includes("__tests__/")
const importsOf = (f) =>
  [...readFileSync(join(SRC, f), "utf8").matchAll(rx)].flatMap((m) => {
    const spec = m[3]
    const t = spec.startsWith("@/") ? resolveFile(join(SRC, spec.slice(2))) : spec.startsWith(".") ? resolveFile(join(SRC, dirname(f), spec)) : undefined
    return t ? [relative(SRC, t)] : []
  })
for (let again = true; again; ) {
  again = false
  for (const f of [...moves.keys()].filter(isTest)) {
    if (importsOf(f).some((t) => !moves.has(t) && !COPIES.includes(t))) {
      moves.delete(f)
      again = true
    }
  }
}
const newPath = new Map([...moves].map(([f, d]) => [f, d])) // app-src path -> package-src path

// ── git mv, then the copies ────────────────────────────────────────────────────────────────────
for (const [from, to] of moves) {
  mkdirSync(dirname(join(PKG, to)), { recursive: true })
  execFileSync("git", ["mv", join(SRC, from), join(PKG, to)], { cwd: ROOT })
}
// git mv leaves the emptied directories behind
const prune = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) prune(join(d, e.name))
  if (!readdirSync(d).length) rmdirSync(d)
}
for (const dir of readdirSync(SRC, { withFileTypes: true }).filter((e) => e.isDirectory())) prune(join(SRC, dir.name))
for (const c of COPIES) {
  mkdirSync(dirname(join(PKG, c)), { recursive: true })
  copyFileSync(join(SRC, c), join(PKG, c))
}

// ── import rewriting ───────────────────────────────────────────────────────────────────────────
// resolveFile above works on the file list taken before the move: afterwards the targets are gone from src.
const stripExt = (p) => p.replace(/\.tsx?$/, "")
// where an app-src file was before the move (for the files that moved)
function rewrite(file, oldDir, newDir, inPackage) {
  const src = readFileSync(file, "utf8")
  const out = src.replace(rx, (whole, pre, q, spec) => {
    let target // app-src relative path of what the specifier names
    if (spec.startsWith("@/")) target = resolveFile(join(SRC, spec.slice(2)))
    else if (spec.startsWith(".")) target = resolveFile(join(oldDir, spec))
    else return whole
    if (!target) return whole
    target = relative(SRC, target)
    const moved = newPath.get(target)
    if (inPackage) {
      let to
      if (target === "lib/backend/index.ts" || target === "hooks/use-auth.ts") to = "host.ts"
      else if (target === "lib/backend/types.ts") to = "adapter.ts"
      else if (moved) to = moved
      else if (COPIES.includes(target)) to = target
      else return whole // not ours to rewrite: reported by the typecheck
      let r = relative(newDir, join(PKG, stripExt(to)))
      if (!r.startsWith(".")) r = "./" + r
      return pre + q + r + q
    }
    if (!moved) return whole
    if (target === "types/index.ts" || target === "types/schemas.ts") return whole // the app keeps barrels here
    return pre + q + "@alter-ego/finance/" + stripExt(moved) + q
  })
  if (out !== src) writeFileSync(file, out)
}

for (const [from, to] of moves) rewrite(join(PKG, to), dirname(join(SRC, from)), dirname(join(PKG, to)), true)
for (const c of COPIES) rewrite(join(PKG, c), dirname(join(SRC, c)), dirname(join(PKG, c)), true)

// the app: its src, scripts, e2e and the configs at its root
const stay = [
  ...all.filter((f) => !moves.has(f)).map((f) => join(SRC, f)),
  ...["scripts", "e2e"].flatMap((d) => (existsSync(join(WEB, d)) ? walk(join(WEB, d)) : [])),
  ...readdirSync(WEB).filter((n) => /\.(ts|mjs)$/.test(n)).map((n) => join(WEB, n)),
].filter((p) => /\.(tsx?|mjs)$/.test(p))
for (const p of stay) rewrite(p, dirname(p), dirname(p), false)

// the shell helpers the package copied say so
const NOTE = {
  "components/confirm-delete-dialog.tsx": "components/confirm-delete-dialog.tsx",
  "hooks/create-crud-hooks.ts": "hooks/create-crud-hooks.ts",
  "lib/zod.ts": "lib/zod.ts",
}
for (const [c, orig] of Object.entries(NOTE)) {
  const p = join(PKG, c)
  const body = readFileSync(p, "utf8")
  const note = `// ponytail: a copy of apps/web/src/${orig}, which the app still uses; the package cannot import the app. Keep the two in step.\n`
  writeFileSync(p, body.startsWith('"use client"') ? body.replace('"use client"\n', '"use client"\n\n' + note) : note + body)
}
console.log(`moved ${moves.size} files, copied ${COPIES.length}`)
