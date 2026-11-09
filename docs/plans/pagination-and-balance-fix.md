# Plan: Transaction Pagination & Account Balance Fix

## Overview

Three interrelated issues after importing a large number of transactions via Money Manager:

1. **No pagination** — `getTransactions` returns ALL rows, the UI renders them all at once
2. **Account balances stuck at 0** — `createTransaction` never updates the stored `balance` column on the `accounts` table; no DB triggers exist
3. **Post-import crash** — cache invalidation triggers a full refetch of all transactions, which overwhelms the browser (symptom of #1)

Fixing #1 (pagination) also fixes #3 (crash).

---

## Issue 1: Transaction Pagination

### Current State

- `TransactionFilters` has no `limit`, `offset`, or `cursor` fields
- `DatabaseAdapter.getTransactions()` returns `Promise<Transaction[]>` — full dataset
- Supabase query has no `.limit()` — downloads every row + joins (tags, splits)
- `TransactionList` renders all items via `.map()` — no virtualization
- Dashboard's `getDashboardData()` internally calls `getTransactions()` with no filters (full table scan)

### Design

**Offset-based pagination** (simpler than cursor for this use case — transactions are sorted by date desc, user can jump pages).

#### New types

```typescript
// src/types/index.ts
export interface PaginationParams {
  limit: number; // page size, default 50
  offset: number; // skip N rows
}

export interface PaginatedResult<T> {
  data: T[];
  total: number; // total matching count (for page count)
  limit: number;
  offset: number;
}
```

Extend `TransactionFilters`:

```typescript
export interface TransactionFilters {
  // ... existing fields ...
  limit?: number;
  offset?: number;
}
```

#### Adapter changes

`DatabaseAdapter.getTransactions` signature change:

```typescript
// BEFORE
getTransactions(userId: string, filters?: TransactionFilters): Promise<Transaction[]>

// AFTER
getTransactions(userId: string, filters?: TransactionFilters): Promise<PaginatedResult<Transaction>>
```

**Supabase** — add `.range(offset, offset + limit - 1)` and use `.select("*", { count: "exact" })` to get total count without fetching all rows. Move `search` filter to Supabase `.or()` / `.ilike()` where possible.

**Mock** — slice in-memory after filtering, return `{ data: result.slice(offset, offset + limit), total: result.length, limit, offset }`.

**Firebase** — same pattern with Firestore's `.limit()` and `.startAfter()`.

Default: `limit = 50, offset = 0` when not provided.

#### Hook changes

```typescript
// src/hooks/use-transactions.ts
export function useTransactions(
  userId: string | undefined,
  filters?: TransactionFilters,
) {
  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, userId, filters],
    queryFn: () => getBackend().db.getTransactions(userId!, filters),
    enabled: !!userId,
    placeholderData: keepPreviousData, // smooth page transitions
  });
}
```

Add `keepPreviousData` from TanStack Query so the UI doesn't flash empty between pages.

#### UI changes — `transactions-shell.tsx`

Add pagination state:

```typescript
const [page, setPage] = useState(0);
const PAGE_SIZE = 50;
const filters = {
  ...filtersFromParams,
  limit: PAGE_SIZE,
  offset: page * PAGE_SIZE,
};
```

Add pagination controls at bottom:

```
< Previous  Page 1 of 24  Next >
```

Reset `page` to 0 when filters change.

#### Dashboard — no change to `getDashboardData`

`getDashboardData` already computes aggregates internally. It should continue fetching what it needs for aggregation. The key fix: in Supabase adapter, `getDashboardData` should NOT call `this.getTransactions()` — instead, run a direct aggregate query (SUM/GROUP BY) so it never loads all rows into memory.

### Files to modify

| File                                                 | Change                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/types/index.ts`                                 | Add `PaginatedResult<T>`, add `limit?`/`offset?` to `TransactionFilters` |
| `src/lib/backend/types.ts`                           | Change `getTransactions` return type to `PaginatedResult<Transaction>`   |
| `src/lib/backend/supabase.ts`                        | Add `.range()`, `{ count: "exact" }`, default limit 50                   |
| `src/lib/backend/mock.ts`                            | Slice + count after filtering                                            |
| `src/lib/backend/firebase.ts`                        | Add `.limit()` + count query                                             |
| `src/hooks/use-transactions.ts`                      | Add `keepPreviousData`, adjust return type                               |
| `src/components/transactions/transactions-shell.tsx` | Add `page` state, pass `limit`/`offset` in filters, pagination controls  |
| `src/components/transactions/transaction-list.tsx`   | No change (just receives a page-sized array now)                         |
| `src/lib/backend/__tests__/adapter-contract.ts`      | Update tests to handle `PaginatedResult`                                 |
| `src/lib/backend/__tests__/mock.test.ts`             | Update assertions                                                        |

### Callers of `getTransactions` that need updating

These are all the places that call `getTransactions` or `useTransactions` and need to handle the new `PaginatedResult`:

1. `useTransactions` hook — returns `PaginatedResult` now
2. `transactions-shell.tsx` — reads `.data` from the paginated result
3. `settings-shell.tsx` — "Delete All" button shows `transactions?.data.length` — but this is wrong now (shows page count, not total). Change to `transactions?.total`.
4. `mm-import-dialog.tsx` — doesn't use `useTransactions` (uses `db.createTransaction` directly), no change needed
5. `getDashboardData` — calls `getTransactions` internally. Needs to either: (a) pass a high limit, or (b) use direct aggregate queries. Option (b) is better for Supabase.
6. `getReportData` — same as dashboard, calls `getTransactions` internally. Use direct aggregates or pass period-filtered query.
7. `account-detail-shell.tsx` — calls `useTransactions(user?.id, { accountId })`. Needs pagination too, or a reasonable default limit.
8. `exportTransactionsToCSV` in settings — needs ALL transactions for export. Add a `useAllTransactions` hook or pass `limit: 999999`.

---

## Issue 2: Account Balance Not Updating

### Current State

- `accounts.balance` is a stored `DECIMAL(15,2)` column (not computed)
- `createTransaction` only inserts a row into `transactions` — never touches `accounts.balance`
- No DB trigger or function recalculates balance
- MM import creates accounts with `balance: 0`, imports transactions, balance stays 0
- Dashboard reads `account.balance` directly for totals

### Design

**Option chosen: Recompute balance from transactions on-demand.**

Rather than maintaining a stored balance that can drift out of sync, compute balance from transactions. This is the correct approach for a financial app where the transaction ledger is the source of truth.

#### Approach: Supabase aggregate query

Add a helper that computes account balance from its transactions:

```sql
-- Balance = initial_balance + SUM(income/transfer-in) - SUM(expense/transfer-out)
SELECT
  COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
  + COALESCE(SUM(CASE WHEN type = 'transfer' AND transfer_to_account_id IS NOT NULL THEN -amount ELSE 0 END), 0)
  AS computed_balance
FROM transactions
WHERE account_id = $1 AND user_id = $2
```

But this is complex to maintain and would require changes to how transfers are accounted. **Simpler approach**: update `accounts.balance` in the adapter whenever a transaction is created/deleted.

#### Chosen approach: Update balance in `createTransaction` / `deleteTransaction`

In the adapter layer (supabase.ts, mock.ts, firebase.ts):

**On createTransaction:**

```typescript
// After inserting the transaction:
if (type === "income") {
  await supabase.rpc("increment_balance", {
    account_id: accountId,
    delta: amount,
  });
} else if (type === "expense") {
  await supabase.rpc("increment_balance", {
    account_id: accountId,
    delta: -amount,
  });
} else if (type === "transfer") {
  await supabase.rpc("increment_balance", {
    account_id: accountId,
    delta: -amount,
  });
  if (transferToAccountId) {
    await supabase.rpc("increment_balance", {
      account_id: transferToAccountId,
      delta: amount,
    });
  }
}
```

**Supabase RPC function (new migration):**

```sql
CREATE OR REPLACE FUNCTION increment_balance(p_account_id UUID, p_delta DECIMAL)
RETURNS VOID AS $$
  UPDATE accounts SET balance = balance + p_delta WHERE id = p_account_id;
$$ LANGUAGE sql;
```

**On deleteTransaction:** reverse the delta.

**On MM import completion:** After all transactions are imported, recalculate balance for each affected account:

```sql
UPDATE accounts SET balance = (
  SELECT COALESCE(SUM(CASE
    WHEN type = 'income' THEN amount
    WHEN type = 'expense' THEN -amount
    WHEN type = 'transfer' THEN -amount
    ELSE 0
  END), 0)
  FROM transactions WHERE account_id = accounts.id AND user_id = $1
) WHERE user_id = $1;
```

This bulk recalculation is safer for imports than per-transaction increments (avoids race conditions with parallel batches).

#### New adapter method

```typescript
// src/lib/backend/types.ts
recalculateBalances(userId: string): Promise<void>
```

Called once at the end of MM import instead of per-transaction updates.

### Files to modify

| File                                                          | Change                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| `src/lib/backend/types.ts`                                    | Add `recalculateBalances(userId: string): Promise<void>` |
| `src/lib/backend/supabase.ts`                                 | Implement using raw SQL or RPC                           |
| `src/lib/backend/mock.ts`                                     | Compute from in-memory transactions                      |
| `src/lib/backend/firebase.ts`                                 | Compute from Firestore transactions                      |
| `src/components/transactions/mm-import-dialog.tsx`            | Call `recalculateBalances` after import                  |
| `supabase/migrations/20260302000014_recalculate_balances.sql` | RPC function                                             |

### Why not also update per-transaction?

For the normal CRUD flow (single transaction create/edit/delete), we should also update balances. But this plan focuses on the import scenario. Per-transaction balance updates can be added later as a follow-up — the `recalculateBalances` method handles the correctness concern.

---

## Issue 3: Post-Import Crash

**Root cause**: Issues 1 + 2 combined. After importing 500+ transactions, cache invalidation triggers a full refetch with no limit, and the UI tries to render all 500+ DOM nodes at once.

**Fix**: Pagination (Issue 1) limits the fetch to 50 rows and the UI renders only 50 DOM nodes. No virtualization needed at 50 items per page.

---

## Implementation Order

1. **Add `PaginatedResult` type + extend `TransactionFilters`** (types only)
2. **Update adapters** — mock first (tests), then supabase, then firebase
3. **Update hook** — `useTransactions` returns `PaginatedResult`
4. **Update all callers** — transactions-shell, settings-shell, account-detail-shell, etc.
5. **Add pagination UI** to transactions-shell
6. **Add `recalculateBalances`** adapter method + Supabase migration
7. **Wire into MM import dialog**
8. **Update contract tests**
9. **Run full quality pipeline**: `pnpm lint && pnpm test --run && pnpm build`

## Testing Strategy

- **Unit**: Adapter contract tests — verify pagination params work, total count is correct
- **Unit**: Mock adapter — verify offset/limit slicing, edge cases (offset > total, limit 0)
- **Unit**: `recalculateBalances` — create transactions, verify balances match
- **E2E**: Transaction page shows pagination controls, navigation works
- **E2E**: MM import → accounts show correct balance after import
