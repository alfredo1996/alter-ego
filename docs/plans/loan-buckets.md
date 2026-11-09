# Loan Buckets — who owes what on a personal loan account

## Overview

The owner tracks money lent to people as transfers into a personal account of
type `loan` ("Prestiti": 660 rows). The person is only in the description
("Soldi Alice") and the running balance per person is kept by hand in the
notes ("Mancano 800"), which already drift apart between rows. The account
page shows one total and a flat list: no way to see who owes what.

Fix: derive one bucket per person from the description and show them on the
account page. No schema change, no migration, no new field. The description
already carries the person in 575 of 660 rows (87%); the rest ("Soldi
ragazzi", "Capodanno") fall in their own buckets, which is a feature: they
show what still has to be attributed, and a description edit (already
possible) moves a row to the right bucket.

Rejected: one account per person (660 rows to re-home, account list bloats);
a counterparty field or tags (schema, rules, forms, MCP, bulk edit and a
migration, for a key the data already has). Revisit tags only if the
description proves too noisy in use.

Not AI: pure string grouping, works in every `ai_mode`.

## Impact analysis

| Area               | Change                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Adapter interfaces | None. Reads `useTransactions(userId, { accountId })`, already fetched unpaginated on the page for the chart.                                                 |
| Types / Zod        | None.                                                                                                                                                        |
| Firestore rules    | None.                                                                                                                                                        |
| MCP                | None. `list_transactions account=Prestiti search="Soldi Alice"` already lists one person's rows. A `byPerson` block in `list_accounts` is YAGNI until asked. |
| Scope              | `src/lib`, `src/components/accounts`.                                                                                      |
| Existing tests     | None break: additive lib + additive card.                                                                                                                    |

## Files

Create:

- `src/lib/loan-buckets.ts` — the grouping.
- `src/lib/__tests__/loan-buckets.test.ts` — its tests.
- `src/components/accounts/loan-buckets-card.tsx` — the card.

Modify:

- `src/components/accounts/account-detail-shell.tsx` — render the card between the header and the chart when `account.type === "loan"`, with `allTransactions`.

## Data

```ts
// src/lib/loan-buckets.ts
export interface LoanBucket {
  /** Grouping key: description lower-cased, trimmed, leading "soldi" dropped. */
  key: string;
  /** Display name: the remainder as last written ("Alice"), or the whole description when nothing is left. */
  name: string;
  /** Σ txDelta over the bucket's rows: > 0 they owe you (money sits in the loan account), < 0 you owe them. */
  balance: number;
  /** Money that went into the account (lent) and out of it (paid back). */
  lent: number;
  repaid: number;
  count: number;
  lastDate: Date;
}

export function loanBuckets(
  transactions: Transaction[],
  accountId: string,
): LoanBucket[];
```

- Uses `txDelta` from `src/lib/account-ledger.ts` so the sum of every bucket's
  `balance` equals `account.balance - account.openingBalance`. That is the
  invariant the test asserts: nothing is dropped or double-counted.
- Every row of the account counts, transfers and not: a balance adjustment
  or an expense booked on the account gets its own bucket instead of silently
  breaking the invariant.
- `lent` / `repaid` are the positive and negative deltas, so "Alice: lent
  1,000, paid back 200, owes 800" reads straight off one row.
- Sorted by `balance` descending, ties by `lastDate` descending. Buckets at
  exactly 0 are kept (settled) but the card lists them after the open ones,
  collapsed under "Settled (n)".
- Normalisation: `description.trim().toLowerCase().replace(/^soldi\s+/, "")`.
  No stemming, no fuzzy matching (ponytail: a typo makes a second bucket the
  owner fixes by editing the description; a name field is the upgrade path).
  Rounded with the same 2-decimal rounding `recalculateBalances` uses.

## Component tree

```
AccountDetailShell
├── header Card                 (unchanged)
├── LoanBucketsCard             NEW, only when account.type === "loan"
│   ├── CardHeader "By Person" + total owed to you
│   ├── <ul> one row per open bucket: name · lent / paid back · balance
│   │     name is a Link to /transactions?accountId=…&search=<name>
│   └── <details> "Settled (n)" with the zero-balance buckets
├── Balance Over Time Card      (unchanged)
└── Transactions Card           (unchanged)
```

- Rows: `flex justify-between`, `tabular-nums`, `min-w-0 truncate` on the
  name; the lent / paid-back detail drops to a second line under `sm:`.
  Tap targets follow the page's `pointer-coarse:` padding pattern.
- Negative bucket (you owe them) renders in the muted colour with the sign,
  no warning banner: on the personal side both directions are legitimate.
- Empty account: the card is not rendered.
- Money through `useCurrency().format(amount, account.currency)`, never
  `Intl.NumberFormat` directly.
- No new hook: the card is a pure function of `allTransactions`, `account`
  and `format`.

## Hook dependencies

Existing only: `useTransactions(userId, { accountId })` (already on the page),
`useCurrency`. `useMemo` over `allTransactions` for the buckets.

## Testing

`src/lib/__tests__/loan-buckets.test.ts` (vitest, same `t()` helper style as
`account-ledger.test.ts`):

1. Groups "Soldi Alice" and "soldi alice " into one bucket named "Alice".
2. A description with nothing after "Soldi" or without it ("Capodanno") is its own bucket under the full description.
3. Transfer in = lent, transfer out = repaid, `balance = lent - repaid`; incoming and outgoing transfers both counted via `txDelta`.
4. Invariant: Σ balance over buckets equals Σ `txDelta` over the account's rows, with a mix of transfers, an expense and an income.
5. Sort: open buckets by balance descending, settled ones (0) last.
6. Rows belonging to another account are ignored (`txBelongsToAccount`).

Component: one render test in `src/components/accounts/__tests__/loan-buckets-card.test.tsx`
checking the names, the total and that a zero bucket sits under "Settled".
Shell gate (`type === "loan"` shows the card, `checking` does not) in the
same file.

Gate: `pnpm test --run`.
No `src/lib/backend`, `src/lib/mcp` or rules change, so the emulator suite is
not required.

## Out of scope, noted

- "Prestiti" is stored with `kind: liability` but holds money lent out, an
  asset: today 4,000 € are subtracted from net worth instead of added. The
  account form already edits `kind`; the owner flips it. The card could show
  a one-line hint when `kind === "liability"` and the buckets are positive,
  but that is a second PR if wanted.
- The hand-kept "Mancano NNNN" notes become redundant; nothing clears them.
- Showing the card on the dashboard account cards, or a per-person page.
- An MCP `byPerson` field: add to `list_accounts` only when someone asks the
  assistant "how much does Alice owe me".

## Open questions

None blocking. Default taken: every row of the account counts (invariant
over the account balance) rather than transfers only.

## Tracking

| Milestone                                   | Issue                              |
| ------------------------------------------- | ---------------------------------- |
| Loans 1: By Person on the loan account page | #210 (this plan) |
| Loans 2: Lent money counts as an asset      | #211             |
| Loans 3: MCP answers who owes what          | #212             |
