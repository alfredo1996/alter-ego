# Running Alter Ego locally

No cloud account, no SaaS, no data leaving the machine. The app runs against a
Firebase emulator in Docker, which both the browser and the server talk to — so
the UI and the MCP server see the same data.

## Requirements

- Docker
- Node 24 + pnpm

## Start

```bash
pnpm install
pnpm local:start     # emulator, restoring ./.emulator-data if present
pnpm dev:emulator    # the app, on http://localhost:3003
```

Sign-up is closed in the app: production admits one uid (the allowlist,
`isAllowedUser()` in `firestore/base.rules`).
`pnpm local:start` loads the rules with that allowlist open, so in the browser any
account works. Create one with `pnpm seed:demo`, or in the Auth emulator UI on
http://localhost:4000. To run your own deployment, put your uid in
`firestore/base.rules` and in `apps/web/src/lib/owner-uid.ts`, then `pnpm rules:build`. Stop with:

```bash
pnpm local:stop      # exports data on the way out
```

`pnpm local:logs` tails the emulator. The emulator UI is on http://localhost:4000.

## Where your data lives

`./.emulator-data/export` — Firestore documents and the Auth accounts. It is
written when the emulator shuts down and read back when it starts.

**Back that folder up. Deleting it resets the app to empty.**

Two consequences of exporting on shutdown:

- Stop with `pnpm local:stop`, not by killing Docker. The export runs on SIGTERM;
  a `docker kill` loses everything since the last clean stop.
- A crash loses the session's writes. If that matters, stop and start
  periodically — each clean stop is a checkpoint.

## Connecting an MCP client

The same tools the hosted server exposes over HTTP are also available over stdio,
for a client that spawns the server as a subprocess — Claude Desktop, or a local
model that speaks MCP. No OAuth and no tokens: the client already owns the
process, so the process boundary is the trust boundary.

Find your user id in the emulator UI (http://localhost:4000 → Authentication),
then point the client at:

```json
{
  "mcpServers": {
    "alter-ego": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/alter-ego", "mcp:stdio"],
      "env": {
        "ALTER_EGO_USER_ID": "<your uid from the emulator UI>",
        "NEXT_PUBLIC_BACKEND": "firebase",
        "NEXT_PUBLIC_USE_EMULATOR": "true",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID": "demo-alter-ego",
        "FIRESTORE_EMULATOR_HOST": "localhost:8080"
      }
    }
  }
}
```

`ALTER_EGO_USER_ID` is required — over stdio there is no request to infer the
user from, and defaulting would mean writing to the wrong ledger. The server
exits immediately with a message rather than starting without it.

### Remote clients and OAuth scopes

The HTTP endpoint (`/api/mcp`) authenticates with OAuth 2.1 + PKCE and grants two
scopes: **`data:read`** and **`data:write`**. Clients discover them from
`/.well-known/oauth-authorization-server`, so there is nothing to configure.

**The owner uid still applies locally.** `/api/keys` and `/api/oauth/authorize` check
the uid in `apps/web/src/lib/owner-uid.ts` on the emulator too. Until you put your own
uid there, you cannot create an API key or connect a remote MCP client. Stdio MCP and
the browser UI do not need it.

Try it without a client:

```bash
ALTER_EGO_USER_ID=<uid> NEXT_PUBLIC_BACKEND=mock pnpm mcp:stdio
```

then paste a JSON-RPC `initialize` on stdin.

## The tools

The MCP server (HTTP and stdio) exposes eleven tools. Over HTTP, calls that write need the `data:write` scope.

| Tool                 | What it does                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `list_accounts`      | Accounts with balances, split into assets and liabilities, and the net worth             |
| `list_transactions`  | Transactions, most recent first, with search and date filters                            |
| `list_categories`    | Every category available for a transaction                                               |
| `list_tags`          | Every tag                                                                                |
| `get_spending`       | Spending and income for a month window, by category or by month                          |
| `get_budget_status`  | Every budget for its current period, worst first                                         |
| `add_transaction`    | Records an expense, an income or a transfer                                              |
| `update_transaction` | Changes fields of an existing transaction                                                |
| `delete_transaction` | Deletes a transaction and restores the balance                                           |
| `create_account`     | Opens an account                                                                         |
| `archive_account`    | Closes or reopens an account (closing needs a balance of 0; reopening is always allowed) |

## The REST API

The app also serves a REST API under `/api/v1` (transactions, accounts, budgets,
categories, recurring, tags, reports). Create a key in Settings, under Data
(**Generate New API Key**), and send it as `Authorization: Bearer <key>`. A key is
shown once. The OpenAPI document is served at `/api/openapi` and covers only the transactions endpoints. Creating a key needs the
owner uid, as above.

## What this is and is not

The Firebase emulator is a development tool, not a production database. For one
person on one machine it is a reasonable store: real Firestore semantics, the
same security rules the hosted deployment enforces, and a documented export
format you can read without this app. It is not built for concurrent writers,
large datasets, or unattended uptime.

If it outgrows that, the adapter boundary is the seam to replace: implement
`AccountingAdapter` against
whatever store you prefer, and add it to `NEXT_PUBLIC_BACKEND` in `apps/web/src/lib/env.ts`.
The shared contract in `apps/web/src/lib/backend/__tests__/adapter-contract.ts` is what a
new backend has to satisfy.

## Why this is separate from the test emulator

`docker-compose.yml` backs the test suite and must start empty on every run.
`docker-compose.local.yml` must not. Same image, different command and a volume.
Running the test suite never touches `./.emulator-data`.
