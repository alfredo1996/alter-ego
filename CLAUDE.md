# Alter Ego — Project Conventions

## The Rules File

**`firestore.rules` is generated.** Edit `firestore/base.rules` (the shared helpers and the
other users' collections), `packages/modules/finance/src/finance.rules` (finance's collections
and the nine validators they call, inside `match /users/{userId}`) or
`packages/modules/finance/src/finance-root.rules` (the read-only root `match /categories`) and run `pnpm rules:build`. Editing the output directly loses the
change on the next build, and `apps/web/src/lib/__tests__/firestore-rules-build.test.ts`
fails when the two drift. The two marker lines in `base.rules` (`@@CRM_COLLECTIONS@@` inside
`match /users`, `@@ROOT_COLLECTIONS@@` at the top level) are where the fragments are spliced
in; leave them, and the build fails if a marker or a fragment is missing. The fragments use only
`base.rules`' shared helpers, so a host that vendors the package splices `finance.rules` at its
users-level marker and `finance-root.rules` at its top-level marker, and seeds the root
`categories` collection.

Finance's indexes live in `packages/modules/finance/src/firestore.indexes.json`; the root
`firestore.indexes.json` (the one `firebase.json` deploys) is a copy, and
`apps/web/src/lib/__tests__/firestore-indexes.test.ts` fails when they differ.

Three more tests guard the structure: `packages/kernel/src/__tests__/boundary.test.ts`
(the kernel imports nothing app-side), `packages/ui/src/__tests__/boundary.test.ts`
(the UI kit imports only the kernel and its own dependencies) and
`packages/modules/finance/src/__tests__/boundary.test.ts` (the finance package imports no `@/` path,
nothing from `apps/web`, only the kernel, the UI kit and its declared dependencies).

## Core Principle

**AI is optional.** The app must be fully functional without any AI features, and none is wired today: `AIAdapter` is a seam (`chat()` returns a fixed sentence, `categorize()` returns `null`), `features.aiChat` is `false`, and the `aiMode` setting (`off`, `local`, `cloud`) changes nothing yet.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **State**: Zustand (client settings), TanStack Query (server state)
- **Forms**: React Hook Form + Zod validation
- **Backend**: Adapter pattern — swap Firebase/Mock without touching feature code
- **Testing**: Vitest (unit/integration), Playwright (E2E)
- **Package Manager**: pnpm

## Architecture

The repo is a pnpm workspace. **Every path in this file and in `.claude/` is written from the repo
root** (`apps/web/src/...`, `packages/ui/src/...`). Run the familiar commands from the
repo root: they forward to `apps/web`, which is where tests, the Playwright config and
`.env.local` live.

```
apps/web/                 # the Next.js app (@alter-ego/web); its own .env.local lives here
├── src/
│   ├── app/
│   │   ├── (auth)/       # Login/register (unauthenticated)
│   │   ├── (app)/        # dashboard, accounts, transactions, budgets, goals, recurring, reports, settings
│   │   ├── api/          # REST API (v1), MCP server, OAuth endpoints
│   │   └── [lang]/docs/  # Fumadocs
│   ├── components/
│   │   └── ...           # Shell and settings components (the finance ones live in the package)
│   ├── hooks/            # use-auth, use-api-keys, use-chat
│   ├── lib/
│   │   ├── backend/      # The shell's adapter: auth, API keys, AI, audit; spreads finance's slices
│   │   ├── mcp/          # MCP auth and config; the tools live in @alter-ego/finance
│   │   └── oauth/        # OAuth 2.1 server for the remote MCP endpoint
│   └── types/            # barrels over @alter-ego/finance's types and schemas, plus the app-only ones
├── apphosting.yaml       # App Hosting reads it from the backend's root directory (set to apps/web)
└── e2e/, scripts/, vitest*.ts, playwright*.ts
packages/
├── kernel/               # @alter-ego/kernel: money (currency) and dates.
│                         # Imports nothing app-side
├── ui/                   # @alter-ego/ui: ui/ (shadcn primitives; keep their APIs: add a
│                         # variant, never rename one), page/ (the page kit: every page's h1
│                         # is a PageHeader), FiltersSheet, use-toast, cn(), tokens.css.
│                         # Imports only the kernel and its own dependencies
└── modules/finance/      # @alter-ego/finance: the nine pages and their components, hooks, libs,
                          # stores, types, schemas and the FinanceAdapter interface. Reaches the app
                          # only through provideFinanceHost({ getBackend, useAuth }) (src/host.ts),
                          # which the app's providers and the vitest setup call once. It also holds the
                          # adapter slices (adapter-mock, adapter-firebase, adapter-admin: the app passes
                          # in the Firestore instances), the MCP tools (mcp/: register*(server, { db })),
                          # FINANCE_NAV, <FinanceSettings/>, <FinanceOverlays/> and the finance settings
                          # store (currency and locale). The app's routes are one-line pages from
                          # @alter-ego/finance/pages/*
firestore/, firestore.rules, firebase.json, docker/   # stay at the root
```

Import the packages as `@alter-ego/ui/ui/button`, `@alter-ego/ui/page/page-header`,
`@alter-ego/ui/utils` (`cn`), `@alter-ego/kernel/currency`, `@alter-ego/kernel/dates`,
`@alter-ego/finance/hooks/use-accounts`. Finance code inside the package imports `getBackend` and
`useAuth` from its own `host`, never from the app. `@/types` and `@/types/schemas` in the app
re-export the package's, so those imports did not change.
Each package has a boundary test (`packages/*/src/__tests__/boundary.test.ts`) that
fails on a forbidden import. Type-check everything with `pnpm typecheck`.

## Backend Adapter Pattern

**NEVER import Firebase directly in feature code.**

All data access goes through `@/lib/backend`:

```typescript
import { getBackend } from "@/lib/backend";
const backend = getBackend();
await backend.db.getAccounts(userId);
```

The adapter is selected by `NEXT_PUBLIC_BACKEND` env var (`mock` | `firebase`).

Interfaces in `lib/backend/types.ts`:

- `AccountingAdapter` — the database surface: `FinanceAdapter` (from
  `@alter-ego/finance/adapter`) plus `ApiKeysAdapter`; `DatabaseAdapter` is its alias
- `AuthAdapter`, `AIAdapter`, `BackendAdapter`
- `AuditAdapter` — **server-only**, deliberately off
  `DatabaseAdapter`: `mcp_audit` is `allow read, write: if false`, so the
  client SDK could never implement it. Reached via `getServerDb()`.

This rule is enforced, not just stated: the MCP tools once imported
`firebase-admin` directly, which silently made the whole MCP server Firebase-only.
`apps/web/src/lib/mcp/__tests__/adapter-boundary.test.ts` (the route and the stdio server) and the
package's `src/__tests__/boundary.test.ts` (only `adapter-firebase.ts` and `adapter-admin.ts` may import
a Firebase SDK; `src/mcp/` may not reach them) fail if that returns.

## Coding Conventions

- **File naming**: kebab-case (`use-accounts.ts`, `transaction-list.tsx`)
- **Exports**: Named exports only (no default exports except pages)
- **Imports**: Use `@/*` path alias in the app; inside `packages/modules/finance` imports are
  relative (ESLint forbids `@/*` there) and `getBackend`/`useAuth` come from its `host`
- **Styling**: Use `cn()` utility for conditional Tailwind classes
- **Validation**: Zod schemas for all external data boundaries
- **Components**: forwardRef pattern, displayName for all UI components
- **Types**: Colocate with usage or in `apps/web/src/types/` for shared types (finance types: `packages/modules/finance/src/types.ts`)
- **Language**: the whole app is English: UI copy, zod
  messages, errors, and every MCP title, description and reply. Plain English
  literals, no i18n layer. Title Case for buttons, dialog titles and headings
  ("New Account", "Delete Budget"); sentence case for body text, hints, toasts and
  errors. Italian stays only in user data, the Money Manager import parser, the
  `/it/docs` locale, and in MCP descriptions inside «…»: owner-phrasing routing
  hints (at most 3 per tool). Dates use the date-fns default locale.

## Testing Strategy

- **Vitest**: Unit tests for utilities, hooks, and business logic
  - File pattern: `*.test.ts` colocated in `__tests__/` directories
  - Run: `pnpm test`
- **Playwright**: E2E tests for critical user flows
  - Directory: `apps/web/e2e/`
  - Run: `pnpm test:e2e`

## Commands

```bash
pnpm dev                   # Dev server, mock backend (Turbopack)
pnpm dev:emulator          # Dev server against the local emulator (port 3003)
pnpm build                 # Production build
pnpm lint                  # ESLint
pnpm test                  # Vitest (watch mode)
pnpm test --run            # Vitest (single run)
pnpm test:e2e              # Playwright E2E tests
pnpm shots                 # Every page and tab, sign-in, empty dashboard; desktop + phone, light + dark (mock server; --base, --out, --prefix, paths)
pnpm seed:demo             # Demo user with sample data in the local emulator; credentials in scripts/seed-demo.mjs
pnpm test:firebase:docker  # Emulator suite (Docker)
pnpm rules:build           # Regenerate firestore.rules from firestore/base.rules + the finance fragment
pnpm local:start           # Persistent emulator (docs/SELF-HOSTING.md)
pnpm mcp:stdio             # MCP server over stdio (needs ALTER_EGO_USER_ID)
```

Changes under `apps/web/src/lib/backend/`, `apps/web/src/lib/mcp/` or the rules need the emulator
suite as well as the unit tests — CI runs it on those paths.

A finance write path needs a case in `packages/modules/finance/src/__tests__/contract.ts` (the package
exports it as `@alter-ego/finance/contract`; `apps/web/.../adapter-contract.ts` runs it against the
mock and the client SDK, and `describeFinanceAdminContract` runs the Admin cases in
`firebaseadmin.adapter.test.ts`), so it runs against the emulator, because tests that only run
the mock miss Firestore-only failures. A write path that is not finance's goes in `adapter-contract.ts`.

## Git Conventions

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Branch naming: `feat/`, `fix/`, `refactor/` prefixes
- PR titles match commit convention
- Releases go through an integration branch: PRs target `main` for now; release
  branches may come back with the release process
