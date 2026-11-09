import type { BackendAdapter } from "@/lib/backend"
import type { Page } from "@playwright/test"

// No runtime imports: scripts/shots.mjs loads this file in plain Node, which
// strips the types but resolves no "@/" alias and no extensionless path.

/**
 * A page of the app, opened by its nav link; for a detail page, by the text to
 * click on the list; for a tab, by the tab's name (its path carries `?tab=`).
 */
export interface DemoPage {
  path: string
  nav: string
  open?: string
  tab?: string
  /** A button to click once the page is open, and the dialog it opens, left open for the shot. */
  click?: string
  dialog?: string
}

/** Every page and tab of the app, in nav order. */
export const DEMO_PAGES: DemoPage[] = [
  { path: "/dashboard", nav: "Dashboard" },
  { path: "/accounts", nav: "Accounts" },
  { path: "/accounts/[id]", nav: "Accounts", open: "Main Checking" },
  { path: "/transactions", nav: "Transactions" },
  { path: "/categories", nav: "Categories" },
  { path: "/budgets", nav: "Budgets" },
  { path: "/goals", nav: "Goals" },
  { path: "/recurring", nav: "Recurring" },
  { path: "/recurring?tab=suggested", nav: "Recurring", tab: "Suggested" },
  { path: "/reports", nav: "Reports" },
  { path: "/settings", nav: "Settings" },
]

/**
 * Opens a page the way a person does, by its link: `page.goto` reloads, and a
 * reload wipes the mock backend and signs out. Returns once the page has loaded.
 */
export async function openDemoPage(page: Page, { path, nav, open, tab, click, dialog }: DemoPage): Promise<void> {
  // The sidebar shows from md (768 px) up; below it the links live in the nav sheet.
  const phone = page.viewportSize()!.width < 768
  // The page before may have left a dialog open for its shot.
  if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape")
  if (phone) await page.getByRole("button", { name: /open navigation/i }).click()
  await (phone ? page.getByRole("dialog") : page.locator("aside")).getByRole("link", { name: nav, exact: true }).click()
  // The route alone: in a URL glob `?` is a wildcard, and a tab is clicked, not navigated to.
  const route = path.split("?")[0]
  await page.waitForURL(route.replace("/[id]", ""))
  if (open) {
    // An account row is a clickable card, a client's name a link: both are found by their text.
    await page.getByRole("main").getByText(open, { exact: true }).first().click()
    await page.waitForURL((url) => url.pathname.startsWith(route.replace("[id]", "")))
  }
  if (tab) {
    await waitForPage(page)
    await page.getByRole("main").getByRole("tab", { name: tab }).click()
    await page.getByRole("main").getByRole("tab", { name: tab, selected: true }).waitFor()
  }
  await waitForPage(page)
  if (click) {
    await page.getByRole("main").getByRole("button", { name: click, exact: true }).click()
    await page.getByRole("dialog", { name: dialog }).waitFor()
  }
}

/**
 * Waits out every loading look: the h1, which a page renders only past its
 * data gate (until then the gate shows PageLoader, the app's one spinner), then
 * no spinner and no skeleton left anywhere in it.
 */
export async function waitForPage(page: Page): Promise<void> {
  const main = page.getByRole("main")
  await main.getByRole("heading", { level: 1 }).first().waitFor()
  await page.getByRole("status", { name: "Loading", exact: true }).first().waitFor({ state: "detached" })
  await main.locator(".animate-pulse").first().waitFor({ state: "detached" })
}

/**
 * A lived-in account through window.__mockBackend (the mock, or Firebase on the
 * local emulator: scripts/seed-demo.mjs), synthetic names and amounts only:
 * five accounts with four months of spending, budgets, goals and recurring
 * items. Dates follow today, and nothing is dated after it. Sign in first: a
 * page load wipes the mock.
 */
export async function seedDemo(page: Page): Promise<void> {
  await page.evaluate(async () => {
    type E2eWindow = Window & { __mockBackend?: BackendAdapter; __clearQueryCache?: () => void }
    const backend = (window as E2eWindow).__mockBackend
    if (!backend) throw new Error("window.__mockBackend is missing: the server must run the mock backend or the emulator")
    const user = await backend.auth.getCurrentUser()
    if (!user) throw new Error("not signed in")
    const u = user.id
    const db = backend.db
    const now = new Date()
    const Y = now.getFullYear()
    /** Day `d` of the month `n` months back (0 = this month, -1 = next month). */
    const day = (n: number, d: number) => new Date(Y, now.getMonth() - n, d, 12)
    // Personal
    const cats = await db.getCategories(u)
    // The mock carries the default categories; an emulator nobody ran `pnpm seed:firebase`
    // against has none, so the ones used here become the user's own (Salary stands in for
    // Primary Job, as on the mock). The icon is never shown, and the rules cap it at 10 characters.
    for (const [name, group, color] of [
      ["Salary", "income", "#22c55e"], ["Freelance", "income", "#15803d"], ["Rent", "housing", "#3b82f6"],
      ["Gas", "transportation", "#f97316"], ["Public Transit", "transportation", "#ea580c"], ["Car Insurance", "transportation", "#9a3412"],
      ["Groceries", "food", "#eab308"], ["Restaurants", "food", "#ca8a04"], ["Coffee", "food", "#a16207"],
      ["Electricity", "utilities", "#06b6d4"], ["Internet", "utilities", "#0e7490"], ["Phone", "utilities", "#155e75"],
      ["Doctor", "healthcare", "#ec4899"], ["Pharmacy", "healthcare", "#db2777"], ["Clothing", "personal", "#8b5cf6"],
      ["Gifts Given", "personal", "#6d28d9"], ["Streaming", "entertainment", "#f43f5e"], ["Hobbies", "entertainment", "#be123c"],
      ["Books", "education", "#0d9488"],
    ] as const)
      if (!cats.some((c) => c.name === name)) cats.push(await db.createCategory(u, { name, group, icon: "HelpCircle", color }))
    const cat = (name: string) => {
      const c = cats.find((x) => x.name === name) ?? cats.find((x) => x.name === "Salary")
      if (!c) throw new Error(`no category ${name}`)
      return c.id
    }
    const EUR = "EUR" as const
    const acc = async (name: string, type: "checking" | "savings" | "credit_card" | "cash" | "loan", balance: number, extra: Partial<Parameters<typeof db.createAccount>[1]>) =>
      (await db.createAccount(u, { name, type, currency: EUR, balance, ...extra })).id
    const checking = await acc("Main Checking", "checking", 2400, { color: "#3b82f6" })
    const savings = await acc("Rainy Day Savings", "savings", 11800, { color: "#10b981" })
    const card = await acc("Travel Card", "credit_card", 0, { color: "#f97316" })
    const cash = await acc("Cash Wallet", "cash", 180, { color: "#a855f7" })
    const lent = await acc("Lent to Friends", "loan", 0, { kind: "asset", color: "#64748b" })

    const tx = async (accountId: string, type: "income" | "expense", amount: number, description: string, date: Date, categoryId: string) => {
      if (date <= now) await db.createTransaction(u, { accountId, type, amount, currency: EUR, description, date, categoryId, status: "cleared" })
    }
    const tr = async (accountId: string, transferToAccountId: string, amount: number, description: string, date: Date) => {
      if (date <= now) await db.createTransaction(u, { accountId, type: "transfer", amount, currency: EUR, description, date, transferToAccountId, status: "cleared" })
    }
    const groceries = [["Mercato Verde", 64.2], ["Bio Corner", 38.9], ["Mercato Verde", 92.45], ["Forno Rossi", 12.6], ["Mercato Verde", 71.3]] as const
    for (const n of [3, 2, 1, 0]) {
      if (n < 3) await tx(checking, "income", 2850, "Salary Orbis Consulting", day(n + 1, 27), cat("Primary Job"))
      await tx(checking, "expense", 950, "Rent Via Solferino flat", day(n, 1), cat("Rent"))
      await tx(checking, "expense", 68.4, "Lumina Energia bill", day(n, 6), cat("Electricity"))
      await tx(checking, "expense", 29.9, "FibraNet internet", day(n, 8), cat("Internet"))
      await tx(card, "expense", 13.99, "StreamBox subscription", day(n, 9), cat("Streaming"))
      await tx(checking, "expense", 12.99, "Mobilo phone plan", day(n, 10), cat("Phone"))
      await tx(checking, "expense", 39, "Palestra Atlas membership", day(n, 2), cat("Hobbies"))
      for (const [i, [shop, amount]] of groceries.entries())
        await tx(i % 2 ? card : checking, "expense", +(amount + n * 3.1).toFixed(2), shop, day(n, 3 + i * 5), cat("Groceries"))
      await tx(card, "expense", +(58 + n * 4).toFixed(2), "Trattoria Da Lino", day(n, 12), cat("Restaurants"))
      await tx(card, "expense", +(34.5 + n).toFixed(2), "Sushi Kumo", day(n, 21), cat("Restaurants"))
      for (const k of [4, 11, 18]) await tx(cash, "expense", 3.2, "Caffè Centrale", day(n, k), cat("Coffee"))
      await tx(card, "expense", +(61 + n * 2.5).toFixed(2), "Fuel station A4", day(n, 14), cat("Gas"))
      await tx(checking, "expense", 35, "Monthly transit pass", day(n, 1), cat("Public Transit"))
      await tr(checking, savings, 400, "Monthly saving", day(n, 28))
      await tr(checking, card, 220, "Travel Card payment", day(n, 25))
    }
    await tx(card, "expense", 89.9, "Nord Outfitters jacket", day(2, 17), cat("Clothing"))
    await tx(card, "expense", 42, "Libreria Pagina", day(1, 9), cat("Books"))
    await tx(checking, "expense", 55, "Dr. Ferri check-up", day(1, 15), cat("Doctor"))
    await tx(checking, "expense", 18.7, "Farmacia San Marco", day(0, 7), cat("Pharmacy"))
    await tx(checking, "income", 600, "Side project invoice", day(2, 19), cat("Freelance"))
    await tx(card, "expense", 129, "Concert tickets", day(1, 23), cat("Hobbies"))
    await tx(checking, "expense", 45, "Birthday gift for Elena", day(2, 6), cat("Gifts Given"))
    await tr(checking, cash, 100, "ATM withdrawal", day(2, 3))
    await tr(checking, lent, 300, "Soldi Marco", day(2, 11))
    await tr(checking, lent, 150, "Soldi Giulia", day(1, 4))
    await tr(lent, checking, 100, "Soldi Marco", day(0, 5))

    for (const [name, category, amount] of [["Groceries", "Groceries", 380], ["Eating Out", "Restaurants", 140], ["Coffee", "Coffee", 40], ["Fuel", "Gas", 120], ["Streaming", "Streaming", 20], ["Clothing", "Clothing", 80]] as const)
      await db.createBudget(u, { name, categoryId: cat(category), amount, currency: EUR, period: "monthly" })

    const emergency = await db.createSavingsGoal(u, { name: "Emergency Fund", targetAmount: 15000, currency: EUR, targetDate: new Date(Y + 1, 5, 30), icon: "🛟", color: "#10b981" })
    await db.updateSavingsGoal(u, emergency.id, { currentAmount: 9200 })
    const japan = await db.createSavingsGoal(u, { name: "Japan Trip", targetAmount: 4000, currency: EUR, targetDate: new Date(Y + 1, 3, 15), icon: "✈️", color: "#f43f5e" })
    await db.updateSavingsGoal(u, japan.id, { currentAmount: 1350 })

    // The mock takes startDate as the next due date.
    const rec = (accountId: string, type: "income" | "expense", amount: number, description: string, category: string, frequency: "monthly" | "yearly", startDate: Date) =>
      db.createRecurringTransaction(u, { accountId, type, amount, currency: EUR, description, categoryId: cat(category), frequency, startDate })
    await rec(checking, "income", 2850, "Salary Orbis Consulting", "Primary Job", "monthly", day(0, 27))
    await rec(checking, "expense", 950, "Rent Via Solferino flat", "Rent", "monthly", day(-1, 1))
    await rec(checking, "expense", 29.9, "FibraNet internet", "Internet", "monthly", day(-1, 8))
    await rec(card, "expense", 13.99, "StreamBox subscription", "Streaming", "monthly", day(-1, 9))
    await rec(checking, "expense", 39, "Palestra Atlas membership", "Hobbies", "monthly", day(-1, 2))
    await rec(checking, "expense", 12.99, "Mobilo phone plan", "Phone", "monthly", day(0, 20))
    await rec(checking, "expense", 480, "Car insurance", "Car Insurance", "yearly", new Date(Y + 1, 1, 20))
    await db.takeSnapshot(u)

    // What the pages read before the seed is cached: drop it.
    ;(window as E2eWindow).__clearQueryCache?.()
  })
}
