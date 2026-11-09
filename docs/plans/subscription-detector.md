# Suspected Subscriptions Detector — Implementation Plan

## Overview

Surface forgotten recurring expenses ("the dead Netflix from 2022") as a collapsible section at the top of `/reports`. Distinct from `/recurring`, which is user-declared — this is **algorithmic** and works on transactions already in the history.

### Locked Scope

- **Surface:** collapsible card at the top of `/reports`. Default expanded if ≥1 detected, collapsed if 0.
- **Actions per row:** `Mark as recurring` only. No "Ignore forever" or "Hide for now" in v1 — flagged as Open Question #1.
- **Detection scope:** expenses only (no income, no transfers).
- **Exclude:** transactions already linked to a `RecurringTransaction` (existing `Transaction.isRecurring === true`).

### Anti-goals

- Not a forecasting tool — only highlights what's already happened.
- Not a chart — a list of actionable rows.
- Not a Settings page — zero configuration in v1.
- No AI: pure deterministic heuristics. Functions normally when `ai_mode: off`.

---

## 1. Detection algorithm

Inputs to the pure function:

- `transactions: Transaction[]` — typically all expenses over the analysis window
- `recurringTransactions: RecurringTransaction[]` — to exclude already-declared series
- `normalize: (rawDescription: string) => string` — the existing merchant normalizer (injected so the detector stays pure; the caller passes `useMerchantNormalization().normalize`)
- `now?: Date` — defaulted to `new Date()`, injectable for tests

### Pipeline

**Step 1 — Pre-filter** (drop transactions we can't or shouldn't analyze):

- `type !== "expense"` → drop
- `isRecurring === true` → drop (already covered by an existing recurring rule)
- `amount <= 0` → drop (defensive)
- Date older than the analysis window (default: **last 13 months**, to give annual subscriptions one full cycle plus a small overlap to detect a second occurrence).

**Step 2 — Bucket** by `(accountId, normalize(description), roundedAmount)` where `roundedAmount = round(amount * 0.95 .. 1.05 bucket)`.

- Simplest implementation: bucket key = `${accountId}|${normalizedMerchant}|${Math.round(amount * 100) / 100}` AND a fuzzy merge pass to coalesce neighboring buckets within ±5% amount.
- Buckets with `count < 2` → drop.

**Step 3 — Compute gap statistics** per bucket:

- Sort transactions by date asc.
- `gaps = adjacent date differences in days`.
- `medianGap`, `stdGap`, `firstSeen`, `lastSeen`, `daysSinceLastSeen = now - lastSeen`.

**Step 4 — Classify cadence** using the median gap:

| Cadence | Median gap (days) | Typical use case        |
| ------- | ----------------- | ----------------------- |
| weekly  | 6–8               | gym, weekly food box    |
| monthly | 27–33             | Netflix, Spotify, rent  |
| yearly  | 350–380           | iCloud, domain renewals |

Anything outside these windows → drop (not a clean periodic signal).

**Step 5 — Filter false-positive shapes:**

- `stdGap > 0.40 × medianGap` → drop (too irregular to be a subscription).
- Amount range within bucket: `(max - min) / median > 0.05` after fuzzy merge → drop (variable bills).

**Step 6 — Score confidence** and rank:

```
score =
    1.0 × min(observationCount / 6, 1)      // 6+ observations saturates
  + 0.5 × (1 - stdGap / medianGap)           // tighter cadence = higher score
  + 0.3 × (1 if amount stddev/median < 0.02 else 0)  // exact amount bonus
  - 0.5 × (1 if daysSinceLastSeen > 2*medianGap else 0)  // looks cancelled
```

Threshold for surfacing: `score >= 0.6` AND `observationCount >= 2` (weekly/monthly) OR `observationCount >= 2` AND yearly. Yearly is strictly 2-observation minimum since you can rarely get more in a 13-month window.

Bucket confidence labels for display: `score >= 1.2` → "high", `>= 0.9` → "medium", else "low".

### Algorithm output

```ts
export interface SuspectedSubscription {
  /** Stable hash of (accountId, merchantName, amountBucket) — works as React key */
  id: string;
  merchantName: string; // already normalized
  accountId: string;
  estimatedAmount: number; // median across observations
  currency: Currency;
  cadence: "weekly" | "monthly" | "yearly";
  interval: number; // 1 for v1 (interval=2 etc would map to "every other month" — out of scope)
  observationCount: number;
  firstSeen: Date;
  lastSeen: Date;
  daysSinceLastSeen: number;
  /** "Cancelled?" flag for rows where last hit > 1.5× the median gap ago */
  looksCancelled: boolean;
  confidence: "high" | "medium" | "low";
  /** Source transaction IDs (used to dismiss them when the user marks the series as recurring) */
  transactionIds: string[];
  /** Most common categoryId across observations (null if all uncategorized) */
  suggestedCategoryId: string | null;
}
```

---

## 2. Pure function location & signature

```ts
// src/lib/subscription-detector.ts

export interface DetectSubscriptionsInput {
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  normalize: (rawDescription: string) => string;
  now?: Date;
  /** Lookback in days. Default 395 (13 months). */
  windowDays?: number;
}

export function detectSuspectedSubscriptions(
  input: DetectSubscriptionsInput,
): SuspectedSubscription[];
```

Pure: no side effects, no `Date.now()` calls (uses injected `now`). Trivially testable in Vitest with fixtures.

A small hook wraps it for the UI:

```ts
// src/hooks/use-suspected-subscriptions.ts
export function useSuspectedSubscriptions(userId: string | undefined): {
  data: SuspectedSubscription[];
  isLoading: boolean;
};
```

The hook calls `useTransactions(userId, { dateFrom: 13moAgo, dateTo: now, type: "expense" })` + `useRecurring(userId)` + `useMerchantNormalization(userId)`, then memoizes the detector output.

---

## 3. UI: section on `/reports`

New component: `src/components/reports/suspected-subscriptions-section.tsx`.

Mounted at the top of `ReportsShell`, above the existing summary cards.

```
+-- Suspected subscriptions ----------------------------- [ collapse ] +
|  7 likely subscriptions · ~EUR 84.99/mo (5 monthly, 1 weekly, 1 yearly) |
+-----------------------------------------------------------------------+
|  Merchant            Cadence    Est. cost    Seen   Last         Action |
|  --------------      --------   ---------    -----  -----------  ------ |
|  Netflix             monthly    EUR 14.99    12x    2 days ago   [Mark]|
|  Spotify             monthly    EUR  9.99    11x    5 days ago   [Mark]|
|  iCloud+             yearly     EUR 99.00     2x    14 days ago  [Mark]|
|  Gym                 weekly     EUR 25.00     45x   1 day ago    [Mark]|
|  Dropbox             monthly    EUR 11.99     8x    98 days ago  [Mark]|
|                                                     Cancelled?         |
+-----------------------------------------------------------------------+
```

Behaviors:

- **Default state:** expanded if `data.length > 0`, collapsed otherwise. User toggle persists via a small `useState` (not URL).
- **Empty state when expanded with zero items:** "No suspected subscriptions over the last 13 months." (Discoverability — proves the feature is wired up.)
- **Sort:** by `estimatedMonthlyCost desc` (yearly amount /12, weekly amount ×4.33). Highest-spend candidate first.
- **Currency:** uses `useCurrency()` for formatting. Multi-currency rows show their own currency without conversion.
- **Cancelled badge:** small muted "Cancelled?" pill on rows with `looksCancelled = true`. Still actionable — the user might want to convert it into a `RecurringTransaction` with `isActive: false` for historical tracking.

### Mark-as-recurring flow

Clicking `Mark` opens a small confirm dialog (`mark-as-recurring-dialog.tsx`):

```
+-- Mark as recurring ----------------+
|  Netflix                             |
|                                      |
|  Account     [ Checking         v ]  |
|  Amount      [ 14.99 ]               |
|  Category    [ Subscriptions    v ]  |
|  Frequency   [ monthly          v ]  |
|  Start date  [ 2025-06-15        ]   |
|                                      |
|  [Cancel]              [Create]      |
+--------------------------------------+
```

Prefilled from the detected pattern:

- `accountId` ← most common accountId in observations (the bucket key already locks it to one).
- `amount` ← `estimatedAmount` (median).
- `description` ← `merchantName`.
- `frequency` ← detected cadence.
- `interval` ← `1`.
- `startDate` ← `firstSeen`.
- `categoryId` ← `suggestedCategoryId`.
- `currency` ← carried from the first observation.

On `Create`: `useCreateRecurring().mutate(input)`. The hook already invalidates `["transactions"]` and `["dashboard"]`. We add the recurring query key invalidation implicitly via the hook's existing wiring, which in turn re-runs the detector and the row vanishes (because the new RecurringTransaction now matches against the bucket's transactions in the exclusion step).

**Important wiring detail:** the exclusion step (Step 1) currently filters `isRecurring === true` on the Transaction itself, not by cross-referencing the RecurringTransaction list. After Mark-as-recurring, the existing past transactions are NOT mutated to `isRecurring: true` — only future generated ones are. So we also need a **secondary exclusion**: drop buckets whose `(accountId, merchantName, amount±5%)` matches any existing `RecurringTransaction.{accountId, description, amount}` after normalizing the recurring's description with the same `normalize()` function. This is what makes the row actually disappear post-Mark.

---

## 4. Performance

- Typical user: ~50–200 expenses/month → 13 months × 100 = 1,300 transactions.
- Pipeline is O(n log n) per bucket (date sort) + O(n) bucketing. At n=1,300, <10ms in browser.
- Memoized in the hook via `useMemo([transactions, recurring, rules])`.
- Re-runs only when a `Mark as recurring` succeeds (because TanStack invalidates the recurring query → detector dependency changes).

No server-side computation. No new Firestore reads beyond what `/reports` already fetches.

---

## 5. Files

### Create

| Path                                                         | Purpose                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `src/lib/subscription-detector.ts`                           | Pure `detectSuspectedSubscriptions(input)` + `SuspectedSubscription` interface                               |
| `src/lib/__tests__/subscription-detector.test.ts`            | Unit tests for every detection rule + edge case                                                              |
| `src/hooks/use-suspected-subscriptions.ts`                   | Thin hook composing `useTransactions` + `useRecurring` + `useMerchantNormalization` + memoized detector call |
| `src/components/reports/suspected-subscriptions-section.tsx` | Collapsible UI section                                                                                       |
| `src/components/reports/mark-as-recurring-dialog.tsx`        | Prefill + confirm dialog                                                                                     |

### Modify

| Path                                       | Change                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `src/components/reports/reports-shell.tsx` | Mount `<SuspectedSubscriptionsSection />` above the existing summary cards |

### Not touched

- Backend adapter — no interface changes, all detection is client-side.
- Firestore rules / indexes — no schema changes.
- `RecurringTransaction` model — existing shape is sufficient.

---

## 6. Edge cases & decisions

| Case                                                                                | Handling                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Annual subscriptions** (iCloud, domains)                                          | Window default 13 months gives one full cycle + overlap. Cadence band 350–380d catches them. Minimum 2 observations.                                        |
| **Variable utility bills** (gas, electric)                                          | `(max−min)/median > 0.05` drop in Step 5 filters these out. Better to miss a few than to spam the user with false positives.                                |
| **Same merchant, unrelated purchases** (Amazon weekly groceries vs Prime monthly)   | The `(amount ±5%)` bucket separates them. Prime at exactly €4.99 lands in its own bucket; grocery amounts vary too much to form a tight bucket.             |
| **Price hikes** (Netflix €9.99 → €12.99 mid-year)                                   | Two separate buckets emitted — the user sees both. Each may individually clear the threshold or fall below it. Acceptable for v1; flag as Open Question #2. |
| **Already-cancelled subscriptions**                                                 | `daysSinceLastSeen > 1.5 × medianGap` → `looksCancelled: true` flag. Still shown (user may want to record it).                                              |
| **Multi-currency same merchant**                                                    | Bucket key includes implicit currency (via `accountId`, since accounts are single-currency). Different-currency observations land in different buckets.     |
| **`normalize()` returns empty string** (unrecognized merchant with stripped prefix) | Fall back to `raw.trim().toLowerCase()` so we still bucket.                                                                                                 |
| **Two banks, same subscription** (Netflix on personal + business cards)             | Two separate suggestions, one per account. Acceptable — user marks each.                                                                                    |
| **Backdated import** (user just imported 5 years of history)                        | Window cap at 13 months means we don't surface ancient series. Reasonable default.                                                                          |
| **Empty list**                                                                      | "No suspected subscriptions over the last 13 months." Don't hide the section in v1 — discoverability matters.                                               |
| **Loading state**                                                                   | While `useTransactions` is loading, show a small skeleton. Don't show "0 suspected" prematurely.                                                            |

---

## 7. Test plan (Vitest, `src/lib/__tests__/subscription-detector.test.ts`)

Detector tests (real fixtures, no mocks of internals):

1. Returns empty for `[]` input.
2. Detects a clean monthly subscription (12 observations, exact same amount, ~30-day gaps).
3. Detects a yearly subscription (2 observations, ~365-day gap).
4. Detects a weekly subscription (12+ observations, ~7-day gaps).
5. Drops a series with gaps too irregular (`stdGap > 0.4 × medianGap`).
6. Drops a series with amounts varying >5%.
7. Drops a series with only 1 observation.
8. **Excludes** transactions where `isRecurring === true`.
9. **Excludes** buckets matching an existing `RecurringTransaction` (same accountId, normalized description, amount ±5%).
10. Separates same-merchant transactions by amount bucket (Amazon €4.99 monthly vs Amazon variable purchases).
11. Splits a price hike into two buckets (Netflix at €9.99 and €12.99).
12. Flags `looksCancelled` when `lastSeen` is older than `1.5 × medianGap`.
13. Window cap: drops transactions older than `windowDays`.
14. `suggestedCategoryId` returns the modal category across observations; null when all uncategorized.
15. Calls the injected `normalize()` for description matching (verifies dependency injection).
16. Sort order: results returned by `estimatedMonthlyCost desc`.
17. Deterministic `id` generation: same input → same `id` (used as React key).
18. Handles `now` parameter for cancelled-check determinism.

UI: no unit tests (project convention — UI is covered by Playwright when added; out of scope for this PR per the timesheet/transactions precedent).

---

## 8. Locked decisions

1. **"Ignore forever" IS in v1.** New `dismissedSubscriptionPatterns` collection: `{ userId, patternKey, dismissedAt }`. Detector excludes any bucket whose pattern key matches a dismissed record. Adds backend methods + Firestore rules + a small hook. Worth the ~200 LoC because false positives (rent by bank transfer etc.) would otherwise reappear forever.
2. **Price-hike rows stay split** — two rows for "Netflix €9.99" and "Netflix €12.99". Deferred to v1.5.
3. **Mark-as-recurring `startDate` = `lastSeen + medianGap`** (the projected next-due date). Prevents the existing recurring engine from synthesizing a flood of backdated transactions.
4. **"Cancelled?" rows shown but sorted to the bottom.** Useful for historical tracking; not buried.
5. **Confidence cutoff `score >= 0.6`** kept as v1 default. Tunable later if real-data use shows it's wrong.

---

## Estimate

- ~250 LoC for `subscription-detector.ts` (with comments).
- ~350 LoC for tests (18 cases).
- ~150 LoC for the section + dialog + hook.
- ~10 LoC mounting in `reports-shell.tsx`.
- Single PR, ~1 day of focused work.
