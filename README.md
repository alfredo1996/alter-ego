# Alter Ego

> Track your money: accounts, budgets, goals and reports, on a backend you can swap.

## Overview

Alter Ego is a personal-finance app built on Next.js 16: accounts, transactions,
budgets, savings goals, recurring payments and reports. The backend is swappable
through an adapter (an in-memory `mock`, or Firebase), and an MCP server exposes
the same data to an AI client over HTTP or stdio.

There is no AI in the app today. `AIAdapter` is a seam with no provider behind it,
and nothing in the app depends on it (see [AI](#ai)).

Looking for the company side (clients, pipeline, invoices)? That is a separate app:
[alter-ego-crm](https://github.com/alfredo1996/alter-ego-crm).

## Features

**Core Finance**

- Multi-type accounts (checking, savings, credit card, cash, investment, loan) with balance history
- Transaction CRUD with rich filters (date range, category, type, amount, tags, notes)
- Recurring transactions with auto-generation, pause/resume, and loan amortization
- Loans and per-person buckets, transfers between accounts

**Planning**

- Monthly/annual budgets per category with progress bars and at-risk alerts
- Savings goals with target + deadline tracking and add-funds flow

**Analytics**

- Reports: where it went, in and out, top expenses, net worth chart, budgets this period
- Dashboard: monthly summary, accounts, category spending drill-down, budgets, upcoming bills, goals, recent activity

**Automation**

- Money Manager and CSV import with column mapping and duplicate detection
- Rule-based auto-categorization by description pattern
- Tags for flexible cross-cutting labels

**MCP server (optional)**

- The finance tools (accounts, transactions, budgets, spending) over the same data, for Claude or any MCP client
- Remote over HTTP with OAuth 2.1 + PKCE, or local over stdio with no auth at all
- A REST API (`/api/v1`) with API keys
- See [docs/SELF-HOSTING.md](docs/SELF-HOSTING.md)

## Tech Stack

| Layer           | Tech                                                     |
| --------------- | -------------------------------------------------------- |
| Framework       | Next.js 16 (App Router, Turbopack)                       |
| Language        | TypeScript (strict mode)                                 |
| Styling         | Tailwind CSS v4, shadcn/ui                               |
| State           | Zustand (client settings), TanStack Query (server state) |
| Forms           | React Hook Form + Zod validation                         |
| Backend         | Adapter pattern: Mock / Firebase (swap via env var)      |
| Testing         | Vitest (unit/integration), Playwright (E2E)              |
| Docs            | Fumadocs (MDX-powered documentation site at `/docs`)     |
| Package Manager | pnpm                                                     |

## Getting Started

### Prerequisites

- Node.js 24+ (see `.nvmrc`)
- pnpm 10+
- (Optional) Docker for the Firebase emulator

### Quick start (mock backend, zero config)

```bash
git clone https://github.com/alfredo1996/alter-ego.git
cd alter-ego
pnpm install
pnpm dev          # http://localhost:3000
```

Sign in with a valid email and a password of six or more characters: the mock backend stores everything in memory.
Data lives in the browser tab and is gone on reload, fine for a look around, not
for real use.

### Self-hosted, with data that persists

Runs against a Firebase emulator in Docker. No cloud account, nothing leaves the
machine, and the UI and MCP server share one store:

```bash
pnpm local:start     # emulator, restoring ./.emulator-data
pnpm local:seed      # default categories into the emulator
pnpm dev:emulator    # http://localhost:3003
pnpm local:stop      # exports on the way out
```

Sign-up is closed: the rules and the app admit one user id. Replace the owner uid with
yours before you deploy (see [docs/SELF-HOSTING.md](docs/SELF-HOSTING.md)).

Full setup, MCP client config and the honest limits are in
[docs/SELF-HOSTING.md](docs/SELF-HOSTING.md). To run it on your own Firebase
project, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Environment Variables

Copy `apps/web/.env.example` to `apps/web/.env.local` and set these:

| Variable                                   | Description                   | Required        | Default |
| ------------------------------------------ | ----------------------------- | --------------- | ------- |
| `NEXT_PUBLIC_BACKEND`                      | Backend adapter to use        | No              | `mock`  |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | Firebase API key              | When `firebase` | —       |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Firebase auth domain          | When `firebase` | —       |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | Firebase project ID           | When `firebase` | —       |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID  | When `firebase` | —       |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | Firebase app ID               | When `firebase` | —       |
| `NEXT_PUBLIC_USE_EMULATOR`                 | Point the SDK at the emulator | No              | `false` |

Server-side only, never `NEXT_PUBLIC_` and never committed: needed for the REST
API and the MCP server, which use the Admin SDK and bypass Firestore rules:
`FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`,
`ALTER_EGO_USER_ID` (stdio MCP), `MCP_PUBLIC_ORIGIN`. See `apps/web/.env.example`.

## Project Structure

```
apps/web/src/   (kernel: packages/kernel; UI kit: packages/ui)
├── app/
│   ├── (auth)/              # /login, /register
│   ├── (app)/               # /dashboard, /accounts, /transactions, /categories,
│   │                        #   /budgets, /goals, /recurring, /reports, /settings
│   ├── api/                 # REST API (v1), MCP server, OAuth endpoints
│   └── [lang]/docs/         # Fumadocs pages
├── components/              # Feature components (dashboard, transactions, accounts, …)
├── hooks/                   # TanStack Query hooks (use-accounts, use-transactions, …)
├── lib/
│   ├── backend/             # Adapter: types.ts, mock.ts, firebase.ts
│   ├── mcp/                 # MCP tools (finance-*, shared helpers)
│   ├── oauth/               # OAuth 2.1 authorization server for the MCP endpoint
│   └── …                    # Amortization, CSV import, merchants, net worth, …
├── stores/                  # Zustand: useSettingsStore
└── types/                   # Shared types + Zod schemas
```

## Architecture

### Backend Adapter Pattern

All data access goes through `getBackend()`. **Never** import Firebase directly in feature code:

```typescript
import { getBackend } from "@/lib/backend";
const { db, auth } = getBackend();
const accounts = await db.getAccounts(userId);
```

The adapter is selected by `NEXT_PUBLIC_BACKEND` (`mock` | `firebase`). Each adapter
implements `BackendAdapter` (composed of `AuthAdapter`, `DatabaseAdapter`, and
`AIAdapter`), so you can develop entirely against the mock backend and switch to
Firebase with a single env var change.

### State Management

- **Zustand** (`useSettingsStore`) for client-only settings: currency, locale, theme and the `aiMode` setting
- **TanStack Query** for all server state: accounts, transactions, budgets, etc.

### AI

No AI provider is wired. `AIAdapter` is a seam: `chat()` returns a fixed sentence and
`categorize()` returns `null` in both adapters. `features.aiChat` is `false`, so the
chat entry does not render. Settings has an `aiMode` selector (Off, Local, Cloud) that
is stored and changes nothing yet. The app never needs AI.

## Testing

```bash
pnpm test --run       # unit tests, single run (`pnpm test` alone is watch mode)
pnpm test:coverage    # with coverage report
pnpm test:e2e         # Playwright E2E, against a mock production build
pnpm test:firebase    # adapter contract + rules + MCP tests (requires the emulator)
```

Test files live in `__tests__/` directories next to the code they test.
`apps/web/src/lib/__tests__/firestore-rules-build.test.ts` checks that
`firestore.rules` matches its source: it is **generated** by `pnpm rules:build`
from `firestore/base.rules`, so edit that, never the output.

The adapter contract suite (`apps/web/src/lib/backend/__tests__/adapter-contract.ts`)
defines the tests every backend adapter must pass: it runs against the mock always
and against Firebase when the emulator is up.

## Commands

| Command                     | Description                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm dev`                  | Dev server, mock backend (Turbopack)                                                                   |
| `pnpm dev:emulator`         | Dev server against the local emulator                                                                  |
| `pnpm build`                | Production build                                                                                       |
| `pnpm lint`                 | ESLint                                                                                                 |
| `pnpm typecheck`            | Type check                                                                                             |
| `pnpm test`                 | Vitest (watch mode)                                                                                    |
| `pnpm test --run`           | Vitest (single run)                                                                                    |
| `pnpm test:coverage`        | Vitest with coverage report                                                                            |
| `pnpm test:e2e`             | Playwright E2E tests                                                                                   |
| `pnpm test:firebase`        | Firebase emulator tests                                                                                |
| `pnpm test:firebase:docker` | Same, starts emulator via Docker first                                                                 |
| `pnpm local:start`          | Persistent emulator for self-hosting                                                                   |
| `pnpm local:stop`           | Stop it, exporting data on the way out                                                                 |
| `pnpm local:logs`           | Tail the persistent emulator                                                                           |
| `pnpm local:seed`           | Seed the emulator with default categories                                                              |
| `pnpm emulator:start`       | Ephemeral emulator (tests)                                                                             |
| `pnpm emulator:stop`        | Stop the ephemeral emulator                                                                            |
| `pnpm mcp:stdio`            | MCP server over stdio                                                                                  |
| `pnpm rules:build`          | Regenerate `firestore.rules`                                                                           |
| `pnpm seed:firebase`        | Seed default categories; needs `FIREBASE_PROJECT_ID` and seeds whichever project the Admin SDK reaches |
| `pnpm seed:demo`            | Demo user with sample data (emulator)                                                                  |

## Documentation

- **`/docs`**: Fumadocs site covering the user guide, architecture, backend adapters, deployment, and contributing guides
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**: Deploy your own on Firebase
- **[docs/SELF-HOSTING.md](docs/SELF-HOSTING.md)**: Running it locally with persistent data, the REST API, and connecting an MCP client

## Contributing

- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- **Branch naming**: `feat/`, `fix/`, `refactor/` prefixes
- **File naming**: kebab-case (`use-accounts.ts`, `transaction-list.tsx`)
- **Exports**: Named exports only (no default exports except pages)
- **Imports**: Use `@/*` path alias
- **Styling**: Use `cn()` utility for conditional Tailwind classes
- **Testing**: Add unit tests for new utilities/logic, E2E tests for new user flows

See the [contributing guide](content/docs/en/contributing/conventions.mdx) for full details.

## License

[MIT](LICENSE). Copyright (c) 2026 Alfredo Rubin.
