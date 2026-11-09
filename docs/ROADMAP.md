# Alter Ego — Feature Specification

## Core Principle

**AI is optional.** Every feature works without AI. AI enhances speed, intelligence, and proactivity — but the app is fully functional with zero AI calls and zero cost.

User setting `ai_mode`: **off** | **free** | **paid**

---

## Phase 1 — Personal Finance Dashboard

**Core question: "Where is my money going?"**

The foundation. A beautiful, mobile-first web app for tracking money across accounts. The user logs transactions, sees balances, and understands spending patterns through reports.

### 1.1 Accounts

An account represents a real-world place where money lives: a bank account, a credit card, a cash wallet.

- **Create account**: name, type (checking / savings / credit card / cash), currency, initial balance, icon, color.
- **Edit account**: change name, icon, color, type. Initial balance is editable only if no transactions exist yet.
- **Archive account**: hides from dashboard and transaction forms without deleting data. Archived accounts remain visible in historical reports.
- **Reorder accounts**: drag-and-drop sorting on the accounts page. Dashboard respects this order.
- **Account detail view**: shows current balance, list of transactions for that account, and a balance-over-time chart.
- **Current balance**: computed as `initial_balance + Σ(income to this account) - Σ(expenses from this account) + Σ(transfers in) - Σ(transfers out)`. Never stored — always derived.
- **Multi-currency**: each account has its own currency. The dashboard shows balances in their native currencies. A total net worth in the user's default currency is shown using a simple exchange rate (manual or fetched).

### 1.2 Transactions

A transaction is a single money movement: money going out (expense), money coming in (income), or money moving between accounts (transfer).

- **Create transaction**: type (expense / income / transfer), amount, date (defaults to today), account, category (optional), payee (optional), note (optional).
- **Quick-add flow**: from the floating action button (FAB), the form opens with amount keypad first, optimized for one-hand mobile use. Type defaults to expense. Date defaults to today. After amount, user picks category from a grid, then optionally adds payee/note.
- **Edit transaction**: all fields editable. Changing the account or amount recalculates balances automatically.
- **Delete transaction**: confirmation dialog. Balance updates immediately.
- **Transfer between accounts**: user picks source account, destination account, and amount. Internally stored as a single transaction with `to_account_id`. Shows as outflow on source, inflow on destination.
- **Transaction list**: paginated, sorted by date descending. Each row shows: date, payee/category icon, description, amount (colored red for expense, green for income, blue for transfer), and account name.
- **Basic filters on list**: by account, by type (expense/income/transfer), by date range (this month, last month, custom).

### 1.3 Categories

Categories describe what money was spent on or where income came from. Two levels: parent and subcategory.

- **Pre-seeded defaults**: the app ships with a default set of categories, each with an icon and color:
  - **Expense**: Housing, Transportation, Food & Drink (→ Groceries, Restaurants, Coffee, Bars), Utilities (→ Electricity, Gas, Water, Internet, Phone), Healthcare, Entertainment (→ Streaming, Cinema, Games), Shopping (→ Clothing, Electronics, Home), Personal Care, Education, Gifts & Donations, Travel, Subscriptions, Insurance, Fees & Charges, Other.
  - **Income**: Salary, Freelance, Investments, Refunds, Gifts, Other Income.
- **Custom categories**: user can create, edit, reorder, and archive categories. Custom categories can be top-level or subcategories of existing parents.
- **Category picker**: in the transaction form, shows a grid of icons grouped by parent. Frequently used categories appear first. Searchable.
- **Uncategorized handling**: transactions without a category show a subtle indicator on the dashboard prompting the user to categorize them.

### 1.4 Dashboard

The main screen. Shows the financial snapshot at a glance.

- **Total balance bar**: sum of all non-archived accounts, shown in default currency. Tapping expands to show per-account balances.
- **Account cards**: horizontal scrollable row of cards, each showing account name, icon, balance, and currency. Tapping opens account detail.
- **Monthly summary card**: for the current month, shows total income, total expenses, and the difference (surplus/deficit). Compared to last month with a percentage change.
- **Recent transactions**: last 10 transactions with quick access to full list. Swipe-to-delete on mobile.
- **Spending by category**: small donut chart showing top 5 expense categories this month. Tapping opens full reports.

### 1.5 Reports

Deeper analysis views for understanding spending patterns.

- **Spending by category**: pie/donut chart. Tappable segments drill into subcategories. Table below shows category, amount, percentage, and trend vs previous period.
- **Income vs expenses**: bar chart by month (default last 6 months). Stacked or grouped toggle. Shows surplus/deficit line.
- **Spending over time**: line chart of daily/weekly/monthly spending. Filterable by category.
- **Period selector**: applies to all reports — this month, last month, last 3 months, last 6 months, this year, custom range.

### 1.6 Settings

- **Profile**: display name, default currency, locale (affects date/number formatting).
- **Categories management**: full CRUD, reorder, archive.
- **AI mode toggle**: off / free / paid. When off, chat panel is hidden. When free, connects to Gemini Developer API (user provides their own API key or uses app-provided key). When paid, connects via Firebase AI Logic.
- **Data export**: export all transactions as CSV.
- **Theme**: light / dark / system.

### 1.7 AI Enhancements (when enabled)

- **Chat panel**: slide-out panel (mobile) or sidebar (desktop). Persistent across navigation. Conversation history preserved per session.
- **Natural language transaction entry**: "45 euros groceries at Conad yesterday" → AI parses into structured transaction → shows preview card → user confirms with one tap → saved.
- **Spending queries**: "How much did I spend on food this month?" → AI queries user data → responds with amount, compared to last month.
- **Simple insights**: "You've spent 23% more on dining this month vs your 3-month average" — shown as a card on the dashboard if AI is enabled.
- **Category suggestions**: when creating a transaction, if AI is enabled, it suggests a category based on the payee name.

### 1.8 Authentication

- **Sign up / sign in**: email + password, Google OAuth.
- **Session management**: persistent login, auto-refresh tokens.
- **Data isolation**: every query scoped to authenticated user. Firestore security rules enforce this at the database level.

### 1.9 Mobile-First UX

- **Bottom navigation**: 4 tabs — Dashboard, Transactions, Reports, Settings.
- **Floating Action Button**: always visible, opens quick-add transaction form.
- **Swipe gestures**: swipe left on transaction to delete, swipe right to edit.
- **Pull-to-refresh**: on dashboard and transaction list.
- **Responsive breakpoints**: mobile (< 640px) bottom nav + full-screen forms; tablet (640–1024px) side nav; desktop (> 1024px) full layout with sidebar.
- **Offline**: Firestore offline persistence enabled. Transactions created offline sync when back online.

---

## Phase 2 — Smart Import & Recurring

**Core question: "How do I get my bank data in quickly and keep it flowing?"**

### 2.1 File Import (no AI)

Users can export transactions from their bank as CSV, XLSX, or OFX and import them into Alter Ego.

- **Upload flow**: user selects an account, uploads a file, chooses the file format.
- **OFX/QIF parsing**: these are standardized formats — parsed automatically with no mapping needed. Date, amount, payee, and memo extracted directly.
- **CSV/XLSX manual mapping**: for non-standard formats, user maps columns via dropdown selectors:
  - Required: date column, amount column.
  - Optional: payee/description column, category column, currency column, balance column, note/memo column.
  - User specifies: date format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.), decimal separator (comma or period), number of header rows to skip.
- **Save mapping as template**: after mapping, user can save it with a name (e.g. "Intesa Sanpaolo CSV") for reuse on future uploads.
- **Preview & review**: after mapping, all parsed rows are shown in a review table. Each row shows: parsed date, amount, payee, suggested category (if rules exist), status (new / duplicate / error). User can accept, reject, or modify individual rows.
- **Bulk actions in review**: select all, accept all, reject duplicates.
- **Duplicate detection**: hash of (date + amount + payee). If a matching transaction already exists, the row is flagged as "duplicate" and skipped by default. User can override.
- **Import completion**: accepted rows are created as transactions. Summary shows: X imported, Y skipped (duplicates), Z errors.

### 2.2 AI File Mapping (when AI enabled)

- **Automatic column detection**: instead of manual dropdowns, AI reads the first 10 rows and returns a structured mapping (which column is date, amount, payee, etc.) plus detected date format and decimal separator.
- **User confirmation**: AI mapping shown to user with highlighted columns. User can adjust before proceeding.
- **Auto-save mapping**: AI-generated mappings are saved as templates, tagged as `ai_generated = true`.
- **Smart payee cleanup**: AI normalizes raw merchant strings. "POS CONAD 0421 FIRENZE FI" → "Conad". User corrections feed back into rules.

### 2.3 Smart Categorization

Works in two layers, AI-independent first:

- **Rule-based (no AI)**: user-created rules like "payee contains 'CONAD' → category: Groceries". Rules are checked first, in priority order. The rule engine is simple: match field (payee / note), match type (contains / starts with / exact), target category.
- **AI-based (when enabled)**: if no rule matches, AI suggests a category based on payee and amount. Confidence score shown. User acceptance creates a new rule automatically.
- **Learning loop**: every time user assigns or corrects a category, the system checks if a rule should be created. "You've categorized 3 transactions from 'Netflix' as 'Subscriptions' — create a rule?" → one tap to confirm.

### 2.4 Recurring Transactions

Subscriptions, rent, salary — things that repeat on a schedule.

- **Create recurring rule**: based on an existing transaction ("make this recurring") or from scratch. Fields: frequency (weekly / biweekly / monthly / yearly), day of month/week, start date, end date (optional), auto-confirm toggle.
- **Upcoming view**: shows next 30 days of scheduled transactions. Color-coded by confirmed vs pending.
- **Auto-confirm**: if enabled, the transaction is created automatically on schedule. If disabled, user gets a notification to confirm/skip/modify.
- **Edit/pause/delete rules**: modify schedule, temporarily pause, or remove entirely.
- **Detection from imports**: after importing, if the system detects recurring patterns (same payee, similar amount, regular interval), it suggests creating a recurring rule. Works without AI using simple pattern matching; AI improves detection quality.

### 2.5 Tags

Flexible cross-cutting labels that work alongside categories.

- **Create tags**: freeform text + optional color. Examples: "tax-deductible", "vacation-2026", "shared-expense", "reimbursable".
- **Assign to transactions**: multiple tags per transaction. Searchable and filterable.
- **Tag-based reports**: filter any report view by tag. "Show me all tax-deductible expenses this year."

### 2.6 Advanced Search & Filter

- **Full-text search**: by payee, note, tag name.
- **Filters**: by date range, account, category, tag, amount range, type (expense/income/transfer), has-note, is-uncategorized.
- **Saved filters**: save a frequently used filter combination (e.g. "Work expenses this quarter") for quick access.

### 2.7 Multi-Currency

- **Exchange rate on transaction**: when a transaction's currency differs from the account's currency, user can enter the exchange rate used.
- **Manual rate entry**: user types the rate they actually received (from bank statement).
- **Default currency totals**: dashboard and reports convert to default currency using stored rates. If no rate is stored, a warning is shown.

---

## Phase 3 — Budgeting & Simulations

**Core question: "Am I on budget, and when can I reach my goals?"**

### 3.1 Buckets (Envelope Budgeting)

Buckets are virtual envelopes. Money is allocated from income into buckets, and expenses draw from them. **Buckets ≠ categories**: categories describe what (groceries), buckets describe which envelope (monthly food budget).

- **Create bucket**: name, type (spending / savings goal / debt payoff), icon, color, group (optional), target amount (for goals), target date (for goals), currency.
- **Bucket groups**: organize buckets into groups like "Essentials", "Lifestyle", "Savings Goals". Drag-and-drop reordering.
- **Allocate income**: when income arrives, user distributes it across buckets. UI shows: income received, allocated so far, remaining to allocate. Quick-fill from last month's allocation.
- **Assign transactions to buckets**: each expense can be linked to a bucket. The transaction form adds a "Bucket" picker when budgeting is enabled.
- **Budget overview**: for the current period, each bucket shows: allocated amount, spent so far, remaining. Color-coded: green (under budget), yellow (> 80%), red (over budget).
- **Move money between buckets**: "take €50 from Dining Out, put in Groceries". Logged as a bucket transfer with date and optional note.
- **Rollover**: configurable per bucket. If enabled, unspent amount carries to next period. If disabled, resets to zero.
- **Savings goal tracking**: for savings-type buckets, a progress bar shows current amount vs target. Projected completion date based on recent savings rate.

### 3.2 Budget Reports

- **Budget vs actual**: for each period, bar chart showing allocated vs spent per bucket.
- **Trend**: how spending in each bucket has changed over the last 3/6/12 months.
- **Overspend analysis**: which buckets consistently go over budget. Ranked by total overspend.

### 3.3 Financial Simulations (no AI required)

Interactive calculators with form-based inputs and chart outputs.

- **FIRE calculator**: inputs — current savings, monthly income, monthly expenses, expected investment return rate, inflation rate, target annual spending in retirement. Output — years to financial independence, projected portfolio value over time, safe withdrawal amount. Interactive chart: drag sliders to adjust inputs and see projections update in real-time.
- **Savings goal simulator**: inputs — target amount, current savings, monthly contribution, expected return rate. Output — months to goal, projected timeline chart.
- **Income change simulator**: "What if my income increases/decreases by X?" — shows impact on savings rate, time to goals, budget headroom.
- **Spending change simulator**: "What if I cut category X by €Y/month?" — shows impact on savings rate and goal timelines.
- **Debt payoff calculator**: inputs — balance, interest rate, monthly payment. Output — payoff date, total interest paid. Comparison of strategies (avalanche vs snowball if multiple debts).

### 3.4 AI Enhancements (when enabled)

- **Personalized tips**: AI analyzes spending patterns and suggests specific cuts. "Your coffee shop spending is €127/month. Reducing to 3x/week instead of daily would save €54/month, reaching your emergency fund goal 4 months sooner."
- **Natural language simulations**: "What if I get a €500/month raise?" → AI runs the simulation and presents results conversationally.
- **Proactive budget alerts**: "You've spent 70% of your Dining Out budget and it's only the 15th."
- **Smart allocation suggestions**: based on spending history, AI suggests bucket allocations for the new month.

---

## Phase 4 — Investment Engine

**Core question: "How are my investments performing, and what opportunities exist?"**

### 4.1 Portfolios

A portfolio groups related investments together (e.g. "Retirement", "Trading", "Kids' Fund").

- **Create portfolio**: name, base currency (for reporting), optionally link to a cash account (the bank account used for buying/selling).
- **Portfolio dashboard**: total value, total cost, overall P&L (absolute and percentage), allocation pie chart by asset type / sector / geography.
- **Performance chart**: portfolio value over time. Benchmarks (e.g. MSCI World) shown as comparison lines. Time ranges: 1M, 3M, 6M, YTD, 1Y, 3Y, ALL.

### 4.2 Holdings & Activities

- **Add holding**: search for an asset (by symbol, name, or ISIN), specify quantity and average cost. Or add through a buy activity.
- **Buy activity**: date, asset, quantity, price per unit, fees, tax. Automatically creates/updates the holding and adjusts average cost.
- **Sell activity**: date, asset, quantity, price per unit, fees, tax. Reduces holding quantity. Calculates realized P&L.
- **Dividend activity**: date, asset, gross amount, tax withheld, net received.
- **Link to transaction**: optionally link an investment activity to a bank transaction (e.g. €500 ETF purchase shows as both an investment activity and an expense from checking account).
- **Holdings table**: for each holding — asset name, quantity, average cost, current price, current value, unrealized P&L (€ and %), weight in portfolio.

### 4.3 Assets & Market Data

- **Asset search**: search by symbol, name, or ISIN. Results from a market data API.
- **Asset detail page**: current price, daily change, price chart (1D, 1W, 1M, 3M, 1Y, 5Y), key metrics (P/E, dividend yield, market cap where applicable).
- **Price fetching**: daily automatic update of prices for all held assets. Free API tier (Alpha Vantage, Yahoo Finance, or similar). Prices cached locally.
- **Manual price entry**: for assets not covered by the API (private investments, real estate), user can manually enter current value.

### 4.4 Watchlists

- **Create watchlist**: name (e.g. "ETF Candidates", "Tech Stocks").
- **Add assets to watchlist**: search and add. For each item, optionally set a target buy price and notes.
- **Watchlist view**: table showing asset, current price, daily change, distance from target price.
- **Price alerts**: when an asset crosses the target price, show a notification on the dashboard.

### 4.5 AI Enhancements (when enabled)

- **Weekly portfolio recap** (via chat or as a dashboard card): "Your portfolio gained 2.3% this week, outperforming MSCI World by 0.8%. VWCE was the top performer (+3.1%). Your tech allocation is now 42%, above your 35% target."
- **Rebalancing suggestions**: "Your bond allocation has drifted to 15% (target: 20%). Consider buying €2,000 of AGGH to rebalance."
- **Investment signals**: AI analyzes portfolio composition, market conditions, and user goals to suggest actions. Each signal has a type (buy/sell/hold/rebalance), reason, and confidence score. User can act, dismiss, or snooze.
- **Natural language queries**: "How much dividend income did I receive this year?" "What's my total return on VWCE?" "Compare my portfolio performance to the S&P 500."
- **DCA tracking**: for assets with regular purchases, show average cost evolution and suggest optimal DCA timing based on historical patterns.

---

## Phase 5 — Taxes

**Core question: "What do I owe, and how can I optimize?"**

### 5.1 Capital Gains Tracking (no AI)

Automatic calculation from investment activities.

- **Per-sale gain/loss**: for each sell activity, compute realized gain/loss based on average cost basis. Shows gross gain, applicable tax rate, and estimated tax.
- **Running totals**: for the current fiscal year — total realized gains, total realized losses, net taxable amount, estimated tax liability.
- **Dividend tax tracking**: for each dividend, shows gross amount, withholding tax applied, and net received. Tracks by country of origin for foreign tax credit eligibility.

### 5.2 Tax Summary Report (no AI)

- **Annual summary**: comprehensive breakdown by asset type — stocks, ETFs, bonds, crypto. Shows total gains, losses, net taxable, estimated tax for each.
- **Italian-specific rules**: 26% flat tax on capital gains (redditi diversi), different treatment for ETF income (redditi di capitale), €2,000 minimum tax on foreign accounts (IVAFE), stamp duty (imposta di bollo) at 0.2%.
- **Export**: downloadable report for the commercialista (accountant). PDF format with all details.

### 5.3 AI Enhancements (when enabled)

- **Tax-loss harvesting**: "You have €3,200 in realized gains this year. Selling your position in X (currently at -€1,100) would reduce your tax liability by €286."
- **Year-end optimization**: "You have 6 weeks before fiscal year end. Here are 3 moves that could save you €X in taxes."
- **Regime comparison**: for freelance income (relevant to you), compare forfettario vs ordinario based on actual revenue and expenses.

---

## Phase 6 — Calendar & Life Intelligence

**Core question: "What should I be doing, and who should I stay connected with?"**

### 6.1 Contacts & Relationships (no AI)

A lightweight CRM for personal relationships.

- **Add contact**: name, relationship type (friend / colleague / mentor / client / family), notes, preferred contact frequency (weekly / monthly / quarterly / yearly).
- **Last contacted**: manually logged or auto-detected from calendar events.
- **Follow-up reminders**: if a contact hasn't been reached within their preferred frequency, a reminder surfaces on the dashboard.
- **Contact timeline**: history of interactions (meetings, calls, events together).

### 6.2 Events & Calendar (no AI)

- **Manual event creation**: title, date/time, location, type (personal / work / social / travel / investment), linked contacts.
- **Google Calendar sync**: two-way sync. Events from Google Calendar appear in Alter Ego and vice versa.
- **Event types**: personal, work, social, travel, investment. Each type has a color and icon.
- **Upcoming events view**: next 7/14/30 days. Filterable by type.

### 6.3 Travel Plans (no AI)

- **Create travel plan**: destination, dates, budget, notes.
- **Manual itinerary builder**: add day-by-day activities, accommodations, transportation.
- **Budget tracking**: track travel expenses against the plan budget. Links to transactions tagged with the trip.

### 6.4 AI Enhancements (when enabled)

- **Event recommendations**: based on interests, location, and budget — suggest concerts, meetups, conferences, exhibitions. "There's a React meetup in Milan next Thursday. Your calendar is free."
- **AI travel itinerary**: "Plan a 5-day trip to Lisbon with a €1,500 budget, focusing on food and architecture." → generates day-by-day itinerary with estimated costs.
- **Networking nudges**: "You haven't contacted Marco in 3 months. He mentioned he was launching a startup — worth reconnecting?"
- **Cross-domain intelligence**: "There's a fintech conference in Rome next month. You have €300 in your Education bucket, and your calendar is open. Want me to draft a plan?"

---

## Phase 7 — Net Worth, Sync & Ecosystem

**Core question: "What's my full financial picture, and how do I share it?"**

### 7.1 Net Worth Dashboard (no AI)

- **Unified view**: combines all accounts (checking, savings, credit cards, cash) and all investment portfolios into a single net worth number.
- **Breakdown chart**: assets vs liabilities. Drillable by account type.
- **Net worth over time**: line chart showing historical net worth. Computed from periodic snapshots (daily/weekly/monthly, configurable).
- **Milestones**: mark significant moments ("Paid off car loan", "Reached €100K net worth"). Shown on the timeline.

### 7.2 Multi-Device Sync

- **Firebase mode**: real-time sync out of the box via Firestore.
- **Conflict resolution**: last-write-wins for simple fields. For transactions, dedup by ID.

### 7.3 Shared Households

- **Invite partner**: share a household view where both users see combined finances.
- **Shared vs personal**: some accounts/buckets can be marked as shared, others remain personal.
- **Permissions**: viewer (read-only) or editor (can add/modify transactions).

### 7.4 Data Portability

- **Full export**: JSON or CSV export of all data (accounts, transactions, categories, buckets, investments, etc.).
- **Import from other apps**: import from YNAB, Monarch, or Firefly III export formats.
- **Backup/restore**: manual backup to file, or automatic scheduled backup to cloud storage.

### 7.5 Plugin System (future)

- **Extension points**: custom data sources (bank connectors), custom reports, custom AI prompts.
- **Community plugins**: hosted registry for community-contributed extensions.

### 7.6 AI Enhancements (when enabled)

- **Monthly financial review**: comprehensive AI-generated summary covering spending, budget adherence, investment performance, net worth change, and upcoming financial events.
- **Goal progress narrative**: "You're 67% of the way to your house down payment. At current pace, you'll reach it by March 2028 — 2 months ahead of schedule."
- **Life optimization suggestions**: cross-domain insights connecting finances, investments, calendar, and relationships into actionable advice.

---

## Development Bootstrap

Before writing any application code, the following setup steps must be completed in order:

### Step 0: Reference Project

There is an existing Next.js project, kept in a local folder, that serves as a reference. It contains:

- A **shadcn/ui component library** that should be reused (don't rebuild from scratch)
- A **Next.js app structure** with patterns and approaches optimized for building with Claude Code
- Useful hooks, utilities, and conventions that should be carried over into Alter Ego

**Action:** Before scaffolding Alter Ego, inspect this project's structure, components, hooks, utilities, and CLAUDE.md (if present). Identify what can be reused directly, what needs adapting, and what patterns to follow.

### Step 1: Define CLAUDE.md

Create a `CLAUDE.md` at the project root. This file tells Claude Code how to work with the project. It should include:

- Project overview and goals
- Tech stack and architecture decisions
- Coding conventions (naming, file structure, import patterns)
- Testing strategy
- Key commands (dev, build, test, lint, deploy)
- Component patterns (how to create new pages, forms, charts)
- Backend adapter pattern usage rules
- AI integration guidelines (how to add AI-enhanced features alongside non-AI features)
- Links to this feature spec and the data model

### Step 2: Define Skills & Hooks

Based on the feature spec, define the core reusable building blocks:

**Custom hooks needed (Phase 1):**

- `useAuth` — auth state, sign in/out, current user
- `useAccounts` — CRUD + real-time listener for accounts
- `useTransactions` — CRUD + real-time listener + filters for transactions
- `useCategories` — CRUD + tree structure for categories
- `useChat` — send messages, receive AI responses, conversation history
- `useDashboard` — aggregated data: total balance, monthly summary, spending by category
- `useCurrency` — format amounts with locale-aware currency display

**Custom hooks needed (Phase 2+):**

- `useImport` — file upload, mapping, review flow state machine
- `useRecurring` — recurring rules CRUD + upcoming schedule
- `useTags` — tag CRUD + transaction tagging
- `useBuckets` — bucket CRUD + allocation + budget status (Phase 3)
- `useSimulations` — run simulation calculators (Phase 3)
- `usePortfolio` — portfolio CRUD + holdings + performance (Phase 4)
- `useWatchlist` — watchlist CRUD + price alerts (Phase 4)

**Shared utilities:**

- `currency.ts` — format €1.234,56 (Italian locale), convert between currencies
- `dates.ts` — format dates, period helpers (startOfMonth, endOfMonth, etc.)
- `categories.ts` — default category seeds with icons and colors
- `filters.ts` — transaction filter builder
- `hash.ts` — dedup hash for import (date + amount + payee)

### Step 3: Create GitHub Issues

Create a GitHub project board with issues derived from this roadmap. Each phase becomes a milestone. Each numbered feature section (1.1, 1.2, etc.) becomes an issue or epic. Sub-features become task checkboxes within the issue.

**Issue structure:**

```
Milestone: Phase 1 — Personal Finance Dashboard
  ├── Issue: 1.1 Accounts (CRUD, archive, reorder, detail view, balance computation)
  ├── Issue: 1.2 Transactions (CRUD, quick-add, transfer, list, filters)
  ├── Issue: 1.3 Categories (seeds, custom CRUD, picker, uncategorized handling)
  ├── Issue: 1.4 Dashboard (balance bar, account cards, monthly summary, recent txns, donut chart)
  ├── Issue: 1.5 Reports (spending by category, income vs expenses, spending over time)
  ├── Issue: 1.6 Settings (profile, categories mgmt, AI toggle, export, theme)
  ├── Issue: 1.7 AI Chat Panel (chat UI, NL transaction entry, spending queries, insights)
  ├── Issue: 1.8 Authentication (signup, signin, session management, data isolation)
  ├── Issue: 1.9 Mobile-First UX (bottom nav, FAB, swipe gestures, responsive, offline)
  └── Issue: Project Setup (CLAUDE.md, scaffold, component library, hooks, backend adapter)

Milestone: Phase 2 — Smart Import & Recurring
  ├── Issue: 2.1 File Import (upload flow, OFX parsing, CSV manual mapping, review, dedup)
  ├── Issue: 2.2 AI File Mapping (auto column detection, confirmation, auto-save)
  ├── Issue: 2.3 Smart Categorization (rule engine, AI suggestions, learning loop)
  ├── Issue: 2.4 Recurring Transactions (create, upcoming view, auto-confirm, detection)
  ├── Issue: 2.5 Tags (CRUD, assign, filter, reports)
  ├── Issue: 2.6 Advanced Search & Filter (full-text, filters, saved filters)
  └── Issue: 2.7 Multi-Currency (exchange rate, manual entry, default currency totals)

...and so on for Phases 3–7.
```

Labels: `phase-1` through `phase-7`, `ai-optional`, `ai-enhancement`, `core`, `bug`, `enhancement`.

---

## Roadmap Summary

| Phase | Name                  | Core Question                | AI Required?     |
| ----- | --------------------- | ---------------------------- | ---------------- |
| 1     | **Finance Dashboard** | "Where is my money going?"   | No               |
| 2     | **Smart Import**      | "How do I get data in fast?" | No (AI enhances) |
| 3     | **Budgeting & Sims**  | "Am I on budget?"            | No (AI enhances) |
| 4     | **Investment Engine** | "How are my investments?"    | No (AI enhances) |
| 5     | **Taxes**             | "What do I owe?"             | No (AI enhances) |
| 6     | **Calendar & Life**   | "What should I do next?"     | No (AI enhances) |
| 7     | **Ecosystem**         | "Full picture"               | No (AI enhances) |

Every phase is a shippable, useful product without AI. AI makes each phase smarter, faster, and more proactive — but is never a gate.
