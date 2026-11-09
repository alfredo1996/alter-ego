# Money Manager iOS Import — Implementation Plan

## Overview

Import transactions from **Money Manager** (iOS) TSV exports into Alter Ego. The entire pipeline is **idempotent**: re-importing the same file produces zero duplicates at every layer (accounts, categories, transactions).

## Money Manager Export Format

Tab-separated, 11 columns, Italian headers. Transfers appear as **symmetric pairs** (ingresso + uscita).

```tsv
Periodo	Conto	Categoria	Sotto-categoria	Nota	EUR	Guadagni/Spese	Descrizione	Importo	Valuta	Conto
08/03/2026	Conto in banca	Abbonamento Telefonico		Spotify	18	Spese		18	EUR	18
06/03/2026	Portafoglio	Prestiti		Soldi Alice	250	Trasferimento uscita	Mancano 750	250	EUR	250
06/03/2026	Prestiti	Portafoglio		Soldi Alice	250	Trasferimento ingresso	Mancano 750	250	EUR	250
```

| Col | Header          | Maps To                               | Notes                                                       |
| --- | --------------- | ------------------------------------- | ----------------------------------------------------------- |
| 0   | Periodo         | `date`                                | DD/MM/YYYY                                                  |
| 1   | Conto           | `accountId`                           | Source account                                              |
| 2   | Categoria       | `categoryId` or `transferToAccountId` | Category for expense/income; **dest account** for transfers |
| 3   | Sotto-categoria | —                                     | Sub-category (usually empty, ignored)                       |
| 4   | Nota            | `description`                         | Merchant/payee                                              |
| 5   | EUR             | `amount`                              | Comma decimal: `412,37`, `4,3`                              |
| 6   | Guadagni/Spese  | `type`                                | See type mapping below                                      |
| 7   | Descrizione     | `notes`                               | Extra detail                                                |
| 8   | Importo         | —                                     | Amount duplicate (ignored)                                  |
| 9   | Valuta          | `currency`                            | Currency string (e.g., "EUR")                               |
| 10  | Conto           | —                                     | Account name duplicate (ignored)                            |

### Type Mapping

| Italian                  | Maps To    | Action                         |
| ------------------------ | ---------- | ------------------------------ |
| `Spese` / `Spesa`        | `expense`  | Keep                           |
| `In` / `Entrata`         | `income`   | Keep                           |
| `Trasferimento uscita`   | `transfer` | Keep (source=col1, dest=col2)  |
| `Trasferimento ingresso` | —          | **SKIP** (symmetric duplicate) |

### Transfer Deduplication

Each transfer produces 2 rows in the export:

- **Uscita** (outgoing): `Conto=source, Categoria=dest` — we keep this
- **Ingresso** (incoming): `Conto=dest, Categoria=source` — we skip this

Result: 20 raw rows → 14 after dropping 6 ingresso duplicates.

---

## Idempotency Strategy

### Layer 1: Accounts — Lookup-Before-Create

Match by normalized name (case-insensitive, whitespace-collapsed). Re-import: all resolve → 0 creates.

### Layer 2: Categories — Lookup-Before-Create

Same pattern. Re-import: all resolve → 0 creates.

### Layer 3: Transactions — Import Hash

`hash = SHA-256("mm|" + accountName.lower + "|" + YYYY-MM-DD + "|" + amount.toFixed(2) + "|" + description.lower)`

Uses raw source data (account name, not ID) — deterministic across re-imports. All 3 backends silently return existing row on hash collision.

---

## Files

| File                                                 | Status                                          |
| ---------------------------------------------------- | ----------------------------------------------- |
| `src/lib/money-manager-import.ts`                    | Done — parser, format detection, matching, hash |
| `src/lib/__tests__/money-manager-import.test.ts`     | Done — 49 tests                                 |
| `src/components/transactions/mm-import-dialog.tsx`   | Done — 4-step dialog                            |
| `src/components/transactions/transactions-shell.tsx` | Modified — Money Manager button                 |
