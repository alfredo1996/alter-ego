import { test, expect } from "@playwright/test"

import { signIn, navigateTo, uniqueName } from "./helpers/test-utils"

import type { Page } from "@playwright/test"

/**
 * A page must never show its empty state before its data. "No accounts yet" or
 * "Account not found." for a moment, then the real content popping in, is the
 * bug this guards: the owner wants a spinner, then the page.
 *
 * The mock answers in a microtask, so each test seeds its data at full speed,
 * then gives every read 400 ms (window.__MOCK_LATENCY_MS__, see mock.ts) and
 * walks the pages through the sidebar while a MutationObserver records any
 * empty-state text the DOM ever held, even for one frame. The pages are
 * reached by client-side navigation, not reload, because the mock keeps its
 * data in module state and a reload wipes it and signs out. Pages share
 * queries, so earlier visits would have cached what the next one reads and
 * hidden a missing gate: every visit empties TanStack's cache first, so each
 * page loads from nothing, as after a reload.
 *
 * ponytail: every read waits the same 400 ms, so this catches a page with no
 * gate, not one section's read left out of it (it lands with the rest).
 * loading-states.test.tsx holds single reads back for those.
 */

const EMPTY_STATES = [
  "No transactions yet",
  "Account not found.",
  "Unknown",
  "No accounts yet",
  "No data for this period",
]

type Watched = Window & {
  __emptyStates?: string[]
  __MOCK_LATENCY_MS__?: number
  __clearQueryCache?: () => void
}

async function watchEmptyStates(page: Page) {
  await page.addInitScript((needles: string[]) => {
    const w = window as Watched
    new MutationObserver((records) => {
      if (!w.__emptyStates) return
      for (const r of records) {
        // characterData: React rewrote a text node in place, so its old value
        // was on screen too.
        const texts =
          r.type === "characterData"
            ? [r.oldValue ?? "", r.target.textContent ?? ""]
            : Array.from(r.addedNodes, (n) => n.textContent ?? "")
        for (const t of texts) {
          for (const n of needles) if (t.includes(n)) w.__emptyStates.push(`${location.pathname}: ${n}`)
        }
      }
    }).observe(document, { childList: true, subtree: true, characterData: true, characterDataOldValue: true })
  }, EMPTY_STATES)
}

/** From here on every read is slow and every empty state is recorded. */
async function slowDownAndWatch(page: Page) {
  await page.evaluate(() => {
    const w = window as Watched
    w.__MOCK_LATENCY_MS__ = 400
    w.__emptyStates = []
  })
}

/**
 * Forgets every cached query (see Providers), so the next page starts cold. It
 * cancels fetches in flight too, so call it only once the current page shows.
 */
async function clearQueryCache(page: Page) {
  await page.evaluate(() => {
    const clear = (window as Watched).__clearQueryCache
    if (!clear) throw new Error("window.__clearQueryCache is missing: the e2e server must run the mock backend")
    clear()
  })
}

async function visitCold(page: Page, link: string, url: string) {
  await clearQueryCache(page)
  await navigateTo(page, link, url)
}

async function emptyStatesSeen(page: Page) {
  return page.evaluate(() => (window as Watched).__emptyStates)
}

test.describe("Loading states", () => {
  test.beforeEach(async ({ page }) => {
    await watchEmptyStates(page)
    await signIn(page)
  })

  test("finance pages never show an empty state before their data", async ({ page }) => {
    const accountName = uniqueName("Loading Account")
    await navigateTo(page, "Accounts", "/accounts")
    await page.getByRole("button", { name: /new account/i }).click()
    await page.getByLabel("Name").fill(accountName)
    await page.getByRole("button", { name: /create account/i }).click()
    await expect(page.getByText(accountName).first()).toBeVisible()

    const description = uniqueName("Loading Coffee")
    await navigateTo(page, "Transactions", "/transactions")
    await page.getByRole("button", { name: /new transaction/i }).click()
    await page.getByLabel("Description").fill(description)
    await page.getByLabel("Amount").fill("5")
    await page.getByRole("button", { name: /add transaction/i }).click()
    await expect(page.getByRole("dialog")).not.toBeVisible()

    await slowDownAndWatch(page)

    await visitCold(page, "Dashboard", "/dashboard")
    await expect(page.getByText(description).locator("visible=true").first()).toBeVisible()

    await visitCold(page, "Accounts", "/accounts")
    const account = page.getByText(accountName).first()
    // Clearing mid-load would cancel the list's own fetch: wait for it first.
    await expect(account).toBeVisible()
    await clearQueryCache(page)
    await account.click()
    await expect(page).toHaveURL(/\/accounts\/.+/)
    await expect(page.getByText(description).locator("visible=true").first()).toBeVisible()

    await visitCold(page, "Reports", "/reports")
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible()

    await visitCold(page, "Transactions", "/transactions")
    await expect(page.getByText(description).locator("visible=true").first()).toBeVisible()

    expect(await emptyStatesSeen(page)).toEqual([])
  })
})
