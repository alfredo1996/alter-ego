# Transactions CSV Export — Implementation Plan

This doc covers **only the decisions** — patterns (BOM, escaping, pure-function-then-download, dialog shape, test style) come from the shared helpers already extracted in `src/lib/export.ts`.

## Scope (locked)

- **Button location:** `/transactions` page header. The existing Settings button (`settings-shell.tsx:366`) is removed — single source of truth.
- **Filters in v1:** date range only.
- **Output:** CSV download with the same row schema today's `exportTransactionsToCSV` already produces (no column additions in v1).
- **No backend or adapter changes** — `getTransactions(userId, { dateFrom, dateTo })` already exists (`TransactionFilters` already has `dateFrom`/`dateTo`).

---

## 1. Refactor strategy for `exportTransactionsToCSV`

**Decision: extract + delete.**

Steps:

1. Add `buildTransactionsCsv(input): string` to a new `src/lib/transactions-export.ts` — pure function.
2. Update the Settings caller (`settings-shell.tsx`) to call the new pure function + `downloadCsv` directly — OR remove the Settings button entirely (decided below).
3. Delete `exportTransactionsToCSV` from `src/lib/export.ts` once no callers remain.
4. Move existing `exportTransactionsToCSV` tests in `src/lib/__tests__/export.test.ts` over to `src/lib/__tests__/transactions-export.test.ts`, adapted to the pure-function shape (no DOM stubs needed — same simplification we did for the timesheet exporter).
5. `src/lib/export.ts` keeps the shared helpers (`CSV_BOM`, `escapeCsvValue`, `downloadCsv`). The filename is slightly off ("export.ts" no longer wraps a default exporter) but renaming is churn; defer.

**Settings button:** delete. The user picked "Replace the Settings button so there's one source of truth." That removes the entire "Export All Transactions" `<Button>` from the Data Management Card in `settings-shell.tsx`. The Danger Zone "Delete all transactions" button stays — different concern.

---

## 2. Where the dialog lives

`src/components/transactions/transaction-export-dialog.tsx` — same convention as `timesheet-export-dialog.tsx`. Props: `{ open, onOpenChange }`.

Wired into `src/components/transactions/transactions-shell.tsx`. The shell already has a header row with action buttons (Import, MM Import, etc.); add the new `Export…` button to that group rather than next to the H1 (matches existing layout density in this page; the timesheet page only had an H1, hence the different placement).

---

## 3. Data fetched + preview line

Hooks the dialog calls:

- `useTransactions(user?.id, { dateFrom, dateTo })` — wrapped result, `txResult?.data` is `Transaction[]`. Skip the fetch until both dates are set (mirror `enabled: rangeReady`).
- `useAccounts(user?.id)` — already cached at the page level; just re-use the cached query.

Preview line (the one-liner that confirms the range is non-empty):

```
42 transactions · 3 accounts · €1,234.56 income · €5,678.90 expenses
```

- Skip transfers in the income/expense totals (they're internal moves, not P&L). Show transfer count only if non-zero: `"… · 4 transfers"`.
- Use `useCurrency()` for the currency symbol — not USD-hardcoded.

If the user selects a wide range, `useTransactions` returns all rows (no pagination limit in the export query — the filter has no `limit` set). Acceptable: hundreds of thousands of rows is the threshold to worry about; typical Italian SRL users have orders of magnitude less.

---

## 4. Edge cases unique to transactions

| Case                                                                                 | Decision                                                                                                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Transaction's `accountId` references a deleted account                               | Fall back to the bare `accountId` in the Account column (same as today's behavior — `account?.name ?? t.accountId`).                       |
| `status` field is on `Transaction` but **not** in today's CSV                        | Keep it out in v1 (scope said "same row schema"). Flag as Open Question #1.                                                                |
| `splits` populated — categoryId is null on the parent                                | Keep current behavior: empty Category cell. The accountant gets the description + total; splits live in the app. Flag as Open Question #2. |
| Transfers (both legs have `transferToAccountId` + `linkedTransactionId`)             | Include both legs (current behavior is a faithful dump). Filtering one leg would surprise users who reconciled against the on-screen list. |
| `excludeFromReports = true` transactions                                             | Include them in the export (same as today). They're hidden from reports, not from "all my transactions."                                   |
| Recurring transactions (`isRecurring = true`)                                        | Same as any other transaction. No special marker in v1.                                                                                    |
| `attachments`, `tagIds`, `rawDescription`, `notes` containing newlines/commas/quotes | Already handled by `escapeCsvValue`. The `notes` column already exists; no new columns.                                                    |
| Transaction with no `categoryId` and no splits                                       | Empty Category cell (current behavior).                                                                                                    |
| `currency` differing across rows                                                     | Each row has its own currency column already (current schema). No conversion.                                                              |
| Empty range result                                                                   | Disable Download, show "No transactions in this range." Same UX as timesheet dialog.                                                       |
| Range with `from > to`                                                               | Pure function throws; dialog disables Download (DateRangePicker can produce invalid ranges if user types manually — defensive).            |

---

## 5. Files to create / modify

### Create

| Path                                                        | Purpose                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/transactions-export.ts`                            | Pure `buildTransactionsCsv({ transactions, accounts, dateFrom, dateTo }): string`. Defensive: filters by range inclusive on both ends; sorts by `(date asc, description asc)` for deterministic output. |
| `src/lib/__tests__/transactions-export.test.ts`             | All current `export.test.ts` cases adapted + new range/sort/BOM tests.                                                                                                                                  |
| `src/components/transactions/transaction-export-dialog.tsx` | Dialog. Mirrors `timesheet-export-dialog.tsx`.                                                                                                                                                          |

### Modify

| Path                                                 | Change                                                                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/export.ts`                                  | Remove `exportTransactionsToCSV`. Keep `CSV_BOM`, `escapeCsvValue`, `downloadCsv`. (If preferred, rename file to `src/lib/csv.ts` in a separate PR — out of scope.) |
| `src/lib/__tests__/export.test.ts`                   | Delete the file (all its tests move to `transactions-export.test.ts`). Helpers stay as fixtures inside the new test file.                                           |
| `src/components/transactions/transactions-shell.tsx` | Add `<Export…>` button to the existing header action group; mount `<TransactionExportDialog>`.                                                                      |
| `src/components/settings/settings-shell.tsx`         | Remove the "Export All Transactions" `<Button>` + the unused `useTransactions` + `exportTransactionsToCSV` imports if no other reference.                           |

### Not touched

- `src/lib/backend/types.ts`, `src/lib/backend/mock.ts`, `src/lib/backend/firebase.ts` — no interface changes.
- `src/types/index.ts` — `TransactionFilters.dateFrom/dateTo` already exist.
- Firestore rules / indexes.

---

## 6. Test plan additions

Most tests are 1:1 ports from today's `export.test.ts`. **Genuinely new** cases:

1. Filters by `dateFrom`/`dateTo` inclusive on both ends; entries one ms outside are excluded.
2. Sorts output deterministically by `(date asc, description asc)` — guards against future Firestore ordering changes.
3. Throws on `dateFrom > dateTo`.
4. Preview totals exclude transfers from income/expense sums (one regression test for the preview helper if we extract it; otherwise covered in the dialog smoke test).
5. Multi-currency range produces rows with their original currency, no conversion (regression for a tempting "USD-default" mistake).
6. BOM presence test — same as timesheet exporter.

Existing pass-through tests (RFC 4180 escaping, date format, amount formatting, missing-account fallback, empty list → header-only output, multiple rows, filename pattern) all carry over.

E2E (optional, same posture as timesheet): one Playwright spec that opens the dialog, picks a range, downloads, parses the CSV, asserts header + ≥1 row.

---

## 7. Locked decisions

1. **Status column:** YES, add it. New schema is `Date, Status, Type, Description, Amount, Currency, Account, Category, Notes` (Status slotted second so date+status are the leading reconciliation columns).
2. **Splits:** dialog checkbox `Expand splits into separate rows`, default OFF. When ON, a parent transaction with N splits expands to N rows, each carrying its own `categoryId` and `amount`. Description on expanded rows is `<parent description> — <split note>` when a split has a note, else just the parent description. Parent transactions with empty `splits` are unaffected.
3. **Filename:** `transactions-FROM_to_TO.csv`, with `-expanded` suffix when split expansion is on (e.g. `transactions-2026-01-01_to_2026-06-30-expanded.csv`). Mirrors the `-with-tax` convention from the timesheet exporter.
4. **Settings button:** delete it. Single source of truth at `/transactions`.

---

## Estimate

- ~150 LoC for `transactions-export.ts` (smaller than timesheet — no tax math).
- ~200 LoC of tests (most ported from `export.test.ts`).
- ~80 LoC for the dialog.
- Two small edits: shell button wire-up + Settings cleanup.
- Single PR, ~2–3 hours of focused work.
