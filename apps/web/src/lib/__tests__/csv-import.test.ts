import { describe, it, expect } from "vitest"

import {
  parseCSV,
  tryParseDate,
  tryParseAmount,
  detectDateOrder,
  detectDecimalSeparator,
  autoSuggestColumns,
  inferTransactionType,
  typeFromString,
  computeImportHash,
} from "../csv-import"

// ─── parseCSV ─────────────────────────────────────────────────────────────────

describe("parseCSV", () => {
  it("parses a simple CSV with one data row", () => {
    const result = parseCSV("date,amount,description\n2024-01-15,100.00,Salary")
    expect(result.headers).toEqual(["date", "amount", "description"])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual(["2024-01-15", "100.00", "Salary"])
  })

  it("parses quoted fields containing commas", () => {
    const result = parseCSV('date,description\n2024-01-15,"Coffee, Tea"')
    expect(result.rows[0]).toEqual(["2024-01-15", "Coffee, Tea"])
  })

  it("parses escaped double-quotes inside quoted fields", () => {
    const result = parseCSV('name\n"He said ""hello"""')
    expect(result.rows[0]).toEqual(['He said "hello"'])
  })

  it("handles CRLF line endings", () => {
    const result = parseCSV("date,amount\r\n2024-01-15,100\r\n2024-01-16,200")
    expect(result.headers).toEqual(["date", "amount"])
    expect(result.rows).toHaveLength(2)
  })

  it("handles CR-only line endings", () => {
    const result = parseCSV("date,amount\r2024-01-15,100")
    expect(result.headers).toEqual(["date", "amount"])
    expect(result.rows).toHaveLength(1)
  })

  it("skips blank lines between rows", () => {
    const result = parseCSV("date,amount\n2024-01-15,100\n\n2024-01-16,200")
    expect(result.rows).toHaveLength(2)
  })

  it("returns empty result for an empty string", () => {
    const result = parseCSV("")
    expect(result.headers).toEqual([])
    expect(result.rows).toHaveLength(0)
  })

  it("returns empty result for whitespace-only input", () => {
    const result = parseCSV("   \n  \n")
    expect(result.headers).toEqual([])
    expect(result.rows).toHaveLength(0)
  })

  it("trims whitespace from field values", () => {
    const result = parseCSV(" date , amount \n 2024-01-15 , 100 ")
    expect(result.headers).toEqual(["date", "amount"])
    expect(result.rows[0]).toEqual(["2024-01-15", "100"])
  })

  it("handles header-only CSV with no data rows", () => {
    const result = parseCSV("date,amount,description")
    expect(result.headers).toEqual(["date", "amount", "description"])
    expect(result.rows).toHaveLength(0)
  })

  it("handles a single-column CSV", () => {
    const result = parseCSV("name\nAlice\nBob")
    expect(result.headers).toEqual(["name"])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual(["Alice"])
  })

  it("preserves whitespace inside quoted fields", () => {
    const result = parseCSV('note\n"  spaced  "')
    expect(result.rows[0]).toEqual(["spaced"])
  })
})

// ─── tryParseDate ─────────────────────────────────────────────────────────────

describe("tryParseDate", () => {
  it("parses ISO 8601 date (yyyy-MM-dd)", () => {
    const d = tryParseDate("2024-01-15")
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getMonth()).toBe(0) // January = 0
    expect(d!.getDate()).toBe(15)
  })

  it("parses ISO 8601 datetime with T separator", () => {
    const d = tryParseDate("2024-03-01T10:30:00")
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getMonth()).toBe(2)
  })

  it("parses MM/DD/YYYY format", () => {
    const d = tryParseDate("01/15/2024")
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getMonth()).toBe(0)
    expect(d!.getDate()).toBe(15)
  })

  it("parses M/D/YYYY without zero-padding", () => {
    const d = tryParseDate("1/5/2024")
    expect(d).not.toBeNull()
    expect(d!.getMonth()).toBe(0)
    expect(d!.getDate()).toBe(5)
  })

  it("parses MM/DD/YY two-digit year", () => {
    const d = tryParseDate("01/15/24")
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getDate()).toBe(15)
  })

  it("parses MM-DD-YYYY format", () => {
    const d = tryParseDate("01-15-2024")
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getDate()).toBe(15)
  })

  it("parses YYYYMMDD compact format", () => {
    const d = tryParseDate("20240115")
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getMonth()).toBe(0)
    expect(d!.getDate()).toBe(15)
  })

  it("returns null for an invalid date string", () => {
    expect(tryParseDate("not-a-date")).toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(tryParseDate("")).toBeNull()
  })

  it("trims surrounding whitespace before parsing", () => {
    const d = tryParseDate("  2024-01-15  ")
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
  })

  it("returns null for a string with only numbers that isn't a valid compact date", () => {
    // 7-digit number doesn't match any pattern
    expect(tryParseDate("2024011")).toBeNull()
  })

  it("parses 15/01/2024 as 15 January 2024 in day-first mode", () => {
    const d = tryParseDate("15/01/2024", "dmy")
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getMonth()).toBe(0)
    expect(d!.getDate()).toBe(15)
  })

  it("parses 05/01/2024 as 5 January 2024 in day-first mode", () => {
    const d = tryParseDate("05/01/2024", "dmy")
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getMonth()).toBe(0)
    expect(d!.getDate()).toBe(5)
  })

  it("returns null for 15/01/2024 in month-first mode (month 15)", () => {
    expect(tryParseDate("15/01/2024", "mdy")).toBeNull()
  })

  it("returns null for 31/02/2024 in day-first mode instead of rolling over", () => {
    expect(tryParseDate("31/02/2024", "dmy")).toBeNull()
  })

  it("returns null for 02/30/2024 in month-first mode instead of rolling over", () => {
    expect(tryParseDate("02/30/2024", "mdy")).toBeNull()
  })

  it("returns null for an impossible slash date even without an order argument", () => {
    expect(tryParseDate("02/30/2024")).toBeNull()
    expect(tryParseDate("15/01/2024")).toBeNull()
  })

  it("parses a day-first two-digit-year date", () => {
    const d = tryParseDate("05/01/24", "dmy")
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getMonth()).toBe(0)
    expect(d!.getDate()).toBe(5)
  })

  it("keeps ISO and YYYYMMDD formats independent of the order argument", () => {
    for (const order of ["dmy", "mdy"] as const) {
      const iso = tryParseDate("2024-01-15", order)
      expect(iso!.getMonth()).toBe(0)
      expect(iso!.getDate()).toBe(15)
      const compact = tryParseDate("20240115", order)
      expect(compact!.getMonth()).toBe(0)
      expect(compact!.getDate()).toBe(15)
    }
  })
})

// ─── tryParseAmount ───────────────────────────────────────────────────────────

describe("tryParseAmount", () => {
  it("parses a plain positive decimal", () => {
    expect(tryParseAmount("100.50")).toBe(100.5)
  })

  it("parses a negative number", () => {
    expect(tryParseAmount("-50.00")).toBe(-50)
  })

  it("strips leading $ symbol", () => {
    expect(tryParseAmount("$1,234.56")).toBe(1234.56)
  })

  it("strips € symbol", () => {
    expect(tryParseAmount("€99.99")).toBe(99.99)
  })

  it("strips £ symbol", () => {
    expect(tryParseAmount("£500")).toBe(500)
  })

  it("handles parentheses as negative (accounting format)", () => {
    expect(tryParseAmount("(1,234.56)")).toBe(-1234.56)
  })

  it("strips thousand-separator commas", () => {
    expect(tryParseAmount("1,000,000.00")).toBe(1_000_000)
  })

  it("parses zero", () => {
    expect(tryParseAmount("0")).toBe(0)
  })

  it("parses an integer without decimal", () => {
    expect(tryParseAmount("250")).toBe(250)
  })

  it("returns null for an empty string", () => {
    expect(tryParseAmount("")).toBeNull()
  })

  it("returns null for a non-numeric string", () => {
    expect(tryParseAmount("N/A")).toBeNull()
  })

  it("returns null for whitespace-only string", () => {
    expect(tryParseAmount("   ")).toBeNull()
  })

  it("handles negative with currency symbol", () => {
    expect(tryParseAmount("-$42.00")).toBe(-42)
  })

  it("parses 12,50 as 12.5 with a comma decimal separator", () => {
    expect(tryParseAmount("12,50", ",")).toBe(12.5)
  })

  it("parses 1.234,56 as 1234.56 with a comma decimal separator", () => {
    expect(tryParseAmount("1.234,56", ",")).toBe(1234.56)
  })

  it("parses -3,50 as -3.5 with a comma decimal separator", () => {
    expect(tryParseAmount("-3,50", ",")).toBe(-3.5)
  })

  it("treats spaces as thousands separators with a comma decimal separator", () => {
    expect(tryParseAmount("1 234,56", ",")).toBe(1234.56)
  })

  it("still strips currency symbols with a comma decimal separator", () => {
    expect(tryParseAmount("€12,50", ",")).toBe(12.5)
  })
})

// ─── detectDateOrder ──────────────────────────────────────────────────────────

describe("detectDateOrder", () => {
  it("detects a day-first column (first part > 12)", () => {
    expect(detectDateOrder(["15/01/2024", "20/12/2024", "03/11/2024"])).toBe("dmy")
  })

  it("detects a month-first column (second part > 12)", () => {
    expect(detectDateOrder(["01/15/2024", "12/20/2024", "11/03/2024"])).toBe("mdy")
  })

  it("returns null for an ambiguous column (all parts ≤ 12)", () => {
    expect(detectDateOrder(["05/01/2024", "12/11/2024"])).toBeNull()
  })

  it("returns null for a column without slash dates", () => {
    expect(detectDateOrder(["2024-01-15", "20240115"])).toBeNull()
  })

  it("returns null for an empty column", () => {
    expect(detectDateOrder([])).toBeNull()
  })
})

// ─── detectDecimalSeparator ──────────────────────────────────────────────────

describe("detectDecimalSeparator", () => {
  it("detects a comma column (values end in ,dd and none in .dd)", () => {
    expect(detectDecimalSeparator(["-3,50", "1.234,56", "12,00"])).toBe(",")
  })

  it("keeps period for a period column", () => {
    expect(detectDecimalSeparator(["3.50", "1,234.56", "12.00"])).toBeNull()
  })

  it("returns null when both ,dd and .dd endings appear", () => {
    expect(detectDecimalSeparator(["3,50", "4.20"])).toBeNull()
  })

  it("returns null for integer-only values", () => {
    expect(detectDecimalSeparator(["100", "250"])).toBeNull()
  })

  it("returns null for an empty column", () => {
    expect(detectDecimalSeparator([])).toBeNull()
  })
})

// ─── day-first / decimal-comma import end to end ──────────────────────────────

describe("day-first CSV with decimal-comma amounts (Auto detection)", () => {
  it("imports Date,Description,Amount / 15/01/2024,Coffee,\"-3,50\" as one 3.50 expense on 15 January 2024", () => {
    const parsed = parseCSV('Date,Description,Amount\n15/01/2024,Coffee,"-3,50"')
    const dateIdx = parsed.headers.indexOf("Date")
    const amtIdx = parsed.headers.indexOf("Amount")
    const dateVals = parsed.rows.map((r) => r[dateIdx] ?? "")
    const amtVals = parsed.rows.map((r) => r[amtIdx] ?? "")

    const order = detectDateOrder(dateVals) ?? "mdy"
    const sep = detectDecimalSeparator(amtVals) ?? "."

    expect(order).toBe("dmy")
    expect(sep).toBe(",")

    const date = tryParseDate(dateVals[0], order)
    const rawAmount = tryParseAmount(amtVals[0], sep)

    expect(date).toEqual(new Date(2024, 0, 15))
    expect(rawAmount).toBe(-3.5)
    expect(Math.abs(rawAmount!)).toBe(3.5)
    expect(inferTransactionType(rawAmount!, false)).toBe("expense")
  })
})

// ─── autoSuggestColumns ───────────────────────────────────────────────────────

describe("autoSuggestColumns", () => {
  it("suggests date column from 'Date' header", () => {
    const r = autoSuggestColumns(["Date", "Amount", "Description"])
    expect(r.date).toBe("Date")
  })

  it("suggests description from 'Memo' header", () => {
    const r = autoSuggestColumns(["Date", "Amount", "Memo"])
    expect(r.description).toBe("Memo")
  })

  it("suggests amount from 'Amount' header", () => {
    const r = autoSuggestColumns(["Date", "Amount", "Memo"])
    expect(r.amount).toBe("Amount")
  })

  it("suggests type from 'Transaction Type' header", () => {
    const r = autoSuggestColumns(["Date", "Amount", "Memo", "Transaction Type"])
    expect(r.type).toBe("Transaction Type")
  })

  it("suggests notes from 'Notes' header", () => {
    const r = autoSuggestColumns(["Date", "Amount", "Memo", "Notes"])
    expect(r.notes).toBe("Notes")
  })

  it("uses case-insensitive partial matching", () => {
    const r = autoSuggestColumns(["TRANSACTION DATE", "AMOUNT", "PAYEE"])
    expect(r.date).toBe("TRANSACTION DATE")
    expect(r.description).toBe("PAYEE")
    expect(r.amount).toBe("AMOUNT")
  })

  it("returns empty object for fully unrecognized headers", () => {
    const r = autoSuggestColumns(["col1", "col2", "col3"])
    expect(r.date).toBeUndefined()
    expect(r.description).toBeUndefined()
    expect(r.amount).toBeUndefined()
  })

  it("suggests from partial matches like 'Posted Date'", () => {
    const r = autoSuggestColumns(["Posted Date", "Net Amount", "Merchant Name"])
    expect(r.date).toBe("Posted Date")
    expect(r.description).toBe("Merchant Name")
    expect(r.amount).toBe("Net Amount")
  })

  it("suggests notes from 'Reference' header", () => {
    const r = autoSuggestColumns(["Date", "Amount", "Payee", "Reference"])
    expect(r.notes).toBe("Reference")
  })
})

// ─── inferTransactionType ─────────────────────────────────────────────────────

describe("inferTransactionType", () => {
  it("positive amount is income by default", () => {
    expect(inferTransactionType(100, false)).toBe("income")
  })

  it("negative amount is expense by default", () => {
    expect(inferTransactionType(-50, false)).toBe("expense")
  })

  it("positive amount is expense when signs are flipped", () => {
    expect(inferTransactionType(100, true)).toBe("expense")
  })

  it("negative amount is income when signs are flipped", () => {
    expect(inferTransactionType(-50, true)).toBe("income")
  })

  it("zero amount is treated as expense (not positive)", () => {
    expect(inferTransactionType(0, false)).toBe("expense")
  })

  it("zero amount is treated as income when flipped", () => {
    expect(inferTransactionType(0, true)).toBe("income")
  })
})

// ─── typeFromString ───────────────────────────────────────────────────────────

describe("typeFromString", () => {
  it("returns income for 'credit'", () => {
    expect(typeFromString("credit")).toBe("income")
  })

  it("returns income for 'Credit' (mixed case)", () => {
    expect(typeFromString("Credit")).toBe("income")
  })

  it("returns income for 'CREDIT' (uppercase)", () => {
    expect(typeFromString("CREDIT")).toBe("income")
  })

  it("returns income for 'income'", () => {
    expect(typeFromString("income")).toBe("income")
  })

  it("returns income for 'deposit'", () => {
    expect(typeFromString("deposit")).toBe("income")
  })

  it("returns income for 'CR' abbreviation", () => {
    expect(typeFromString("CR")).toBe("income")
  })

  it("returns income for 'in'", () => {
    expect(typeFromString("in")).toBe("income")
  })

  it("returns expense for 'debit'", () => {
    expect(typeFromString("debit")).toBe("expense")
  })

  it("returns expense for 'payment'", () => {
    expect(typeFromString("payment")).toBe("expense")
  })

  it("returns expense for an unrecognised value", () => {
    expect(typeFromString("other")).toBe("expense")
  })

  it("returns expense for an empty string", () => {
    expect(typeFromString("")).toBe("expense")
  })

  it("returns expense for whitespace-only string", () => {
    expect(typeFromString("   ")).toBe("expense")
  })
})

// ─── computeImportHash ────────────────────────────────────────────────────────

describe("computeImportHash", () => {
  const ACCOUNT_ID = "acc-123"
  const DATE = new Date("2024-03-15T00:00:00")
  const AMOUNT = 42.5
  const DESCRIPTION = "Coffee Shop"

  it("is deterministic — same inputs always produce the same hash", async () => {
    const h1 = await computeImportHash(ACCOUNT_ID, DATE, AMOUNT, DESCRIPTION)
    const h2 = await computeImportHash(ACCOUNT_ID, DATE, AMOUNT, DESCRIPTION)
    expect(h1).toBe(h2)
  })

  it("produces a 64-character hex string (SHA-256)", async () => {
    const hash = await computeImportHash(ACCOUNT_ID, DATE, AMOUNT, DESCRIPTION)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("changing the date produces a different hash", async () => {
    const h1 = await computeImportHash(ACCOUNT_ID, DATE, AMOUNT, DESCRIPTION)
    const h2 = await computeImportHash(ACCOUNT_ID, new Date("2024-03-16T00:00:00"), AMOUNT, DESCRIPTION)
    expect(h1).not.toBe(h2)
  })

  it("changing the amount produces a different hash", async () => {
    const h1 = await computeImportHash(ACCOUNT_ID, DATE, AMOUNT, DESCRIPTION)
    const h2 = await computeImportHash(ACCOUNT_ID, DATE, 99.99, DESCRIPTION)
    expect(h1).not.toBe(h2)
  })

  it("description comparison is case-insensitive ('Coffee' and 'coffee' yield the same hash)", async () => {
    const h1 = await computeImportHash(ACCOUNT_ID, DATE, AMOUNT, "Coffee")
    const h2 = await computeImportHash(ACCOUNT_ID, DATE, AMOUNT, "coffee")
    expect(h1).toBe(h2)
  })

  it("different descriptions produce different hashes", async () => {
    const h1 = await computeImportHash(ACCOUNT_ID, DATE, AMOUNT, "Coffee")
    const h2 = await computeImportHash(ACCOUNT_ID, DATE, AMOUNT, "Tea")
    expect(h1).not.toBe(h2)
  })

  it("changing the accountId produces a different hash", async () => {
    const h1 = await computeImportHash("acc-1", DATE, AMOUNT, DESCRIPTION)
    const h2 = await computeImportHash("acc-2", DATE, AMOUNT, DESCRIPTION)
    expect(h1).not.toBe(h2)
  })
})
