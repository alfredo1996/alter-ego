import type {
  McpAuditEntry,
  User,
  Account,
  Transaction,
  PaginatedResult,
  Category,
  Budget,
  RecurringTransaction,
  SavingsGoal,
  NetWorthSnapshot,
  Tag,
  CategorizationRule,
  ApiKey,
  CreateAccountInput,
  UpdateAccountInput,
  CreateTransactionInput,
  UpdateTransactionInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateBudgetInput,
  UpdateBudgetInput,
  CreateRecurringTransactionInput,
  UpdateRecurringTransactionInput,
  CreateSavingsGoalInput,
  UpdateSavingsGoalInput,
  CreateTagInput,
  CreateCategorizationRuleInput,
  TransactionFilters,
  MonthlyTotals,
  DashboardData,
  ReportData,
  DismissedSubscriptionPattern,
  CreateDismissedSubscriptionPatternInput,
} from "@/types"

export interface AuthAdapter {
  signIn(email: string, password: string): Promise<User>
  signUp(email: string, password: string, displayName: string): Promise<User>
  signOut(): Promise<void>
  getCurrentUser(): Promise<User | null>
  onAuthStateChanged(callback: (user: User | null) => void): () => void
  updateProfile(input: { displayName?: string; email?: string }): Promise<void>
  /**
   * A signed identity token for the current session, or null when signed out.
   *
   * Used by the OAuth consent page to prove to the server who is approving —
   * the alternative is reaching past the adapter into the Firebase SDK.
   */
  getIdToken(): Promise<string | null>
}

export interface AccountingAdapter {
  // Accounts
  getAccounts(userId: string): Promise<Account[]>
  getAccount(userId: string, accountId: string): Promise<Account | null>
  createAccount(userId: string, input: CreateAccountInput): Promise<Account>
  updateAccount(userId: string, accountId: string, input: UpdateAccountInput): Promise<Account>
  deleteAccount(userId: string, accountId: string): Promise<void>

  // Transactions
  getTransactions(userId: string, filters?: TransactionFilters): Promise<PaginatedResult<Transaction>>
  /**
   * The newest transaction date of each account, an incoming transfer counted; null for an
   * account with none. One bounded read per account (limit 1), not the ledger.
   */
  getLastActivity(userId: string, accountIds: string[]): Promise<Record<string, Date | null>>
  getTransaction(userId: string, transactionId: string): Promise<Transaction | null>
  createTransaction(userId: string, input: CreateTransactionInput): Promise<Transaction>
  updateTransaction(userId: string, transactionId: string, input: UpdateTransactionInput): Promise<Transaction>
  deleteTransaction(userId: string, transactionId: string): Promise<void>
  deleteTransactions(userId: string, transactionIds: string[]): Promise<void>
  deleteAllTransactions(userId: string): Promise<void>
  /**
   * Expense totals per month, `fromMonth` to `toMonth` inclusive ("yyyy-MM"), read from the
   * stored `monthly_totals` documents. A month with no complete document is computed once from
   * its transactions and stored (a missing month heals itself), so every month in the range
   * is in the result. Every transaction write keeps these in step, in the same batch.
   */
  getMonthlyTotals(userId: string, fromMonth: string, toMonth: string): Promise<MonthlyTotals>
  /**
   * Start from zero: delete every account and what hangs off one — transactions,
   * recurring transactions, balance and net-worth history. Categories, tags,
   * budgets, rules and API keys stay.
   */
  deleteAllAccountData(userId: string): Promise<void>
  /** All non-null importHashes for the user — used to detect already-imported rows. */
  getImportHashes(userId: string): Promise<string[]>
  recalculateBalances(userId: string): Promise<void>

  // Categories
  getCategories(userId: string): Promise<Category[]>
  getCategory(userId: string, categoryId: string): Promise<Category | null>
  createCategory(userId: string, input: CreateCategoryInput): Promise<Category>
  updateCategory(userId: string, categoryId: string, input: UpdateCategoryInput): Promise<Category>
  deleteCategory(userId: string, categoryId: string): Promise<void>
  /** Delete all of the user's custom categories, leaving only defaults (factory reset). */
  deleteAllCategories(userId: string): Promise<void>

  // Budgets
  getBudgets(userId: string): Promise<Budget[]>
  getBudget(userId: string, budgetId: string): Promise<Budget | null>
  createBudget(userId: string, input: CreateBudgetInput): Promise<Budget>
  updateBudget(userId: string, budgetId: string, input: UpdateBudgetInput): Promise<Budget>
  deleteBudget(userId: string, budgetId: string): Promise<void>

  // Savings goals
  getSavingsGoals(userId: string): Promise<SavingsGoal[]>
  getSavingsGoal(userId: string, goalId: string): Promise<SavingsGoal | null>
  createSavingsGoal(userId: string, input: CreateSavingsGoalInput): Promise<SavingsGoal>
  updateSavingsGoal(userId: string, goalId: string, input: UpdateSavingsGoalInput): Promise<SavingsGoal>
  deleteSavingsGoal(userId: string, goalId: string): Promise<void>

  // Recurring transactions
  getRecurringTransactions(userId: string): Promise<RecurringTransaction[]>
  getRecurringTransaction(userId: string, recurringId: string): Promise<RecurringTransaction | null>
  createRecurringTransaction(userId: string, input: CreateRecurringTransactionInput): Promise<RecurringTransaction>
  updateRecurringTransaction(userId: string, recurringId: string, input: UpdateRecurringTransactionInput): Promise<RecurringTransaction>
  deleteRecurringTransaction(userId: string, recurringId: string): Promise<void>
  generateDue(userId: string, upToDate: Date): Promise<Transaction[]>
  getRecurringHistory(userId: string, recurringId: string): Promise<Transaction[]>

  // Net worth history
  takeSnapshot(userId: string): Promise<NetWorthSnapshot>
  getNetWorthHistory(userId: string, months?: number): Promise<NetWorthSnapshot[]>
  /** The newest snapshot dated on or before the end of `date`'s local day; null with none. One bounded read. */
  getNetWorthAt(userId: string, date: Date): Promise<NetWorthSnapshot | null>

  // Tags
  getTags(userId: string): Promise<Tag[]>
  createTag(userId: string, input: CreateTagInput): Promise<Tag>
  deleteTag(userId: string, tagId: string): Promise<void>

  // Categorization rules
  getCategorizationRules(userId: string): Promise<CategorizationRule[]>
  createCategorizationRule(userId: string, input: CreateCategorizationRuleInput): Promise<CategorizationRule>
  updateCategorizationRule(userId: string, ruleId: string, input: Partial<CreateCategorizationRuleInput & { isActive: boolean }>): Promise<CategorizationRule>
  deleteCategorizationRule(userId: string, ruleId: string): Promise<void>
  applyCategorization(userId: string, description: string): Promise<string | null>
  renormalizeTransactions(userId: string): Promise<number>

  // API keys
  createApiKey(userId: string): Promise<{ key: string; id: string }>
  deleteApiKey(userId: string, keyId: string): Promise<void>
  getApiKeys(userId: string): Promise<Pick<ApiKey, "id" | "prefix" | "createdAt">[]>

  // Autocomplete
  getUniqueDescriptions(userId: string): Promise<string[]>

  // Dashboard
  getDashboardData(userId: string): Promise<DashboardData>

  // Reports
  getReportData(
    userId: string,
    dateRange: { from: Date; to: Date },
    filters?: { accountIds?: string[]; categoryIds?: string[] }
  ): Promise<ReportData>

  // Dismissed subscription patterns
  getDismissedSubscriptionPatterns(userId: string): Promise<DismissedSubscriptionPattern[]>
  createDismissedSubscriptionPattern(userId: string, input: CreateDismissedSubscriptionPatternInput): Promise<DismissedSubscriptionPattern>
  deleteDismissedSubscriptionPattern(userId: string, id: string): Promise<void>
}

export interface AIAdapter {
  chat(userId: string, message: string, context?: Record<string, unknown>): Promise<string>
  categorize(description: string): Promise<{ categoryId: string; confidence: number } | null>
}

export interface BackendAdapter {
  auth: AuthAdapter
  db: DatabaseAdapter
  ai: AIAdapter
}

/** The accounting adapter, the whole of a deployment's database surface. */
export type DatabaseAdapter = AccountingAdapter

/**
 * Server-only surfaces. These are deliberately NOT on DatabaseAdapter: the
 * `mcp_audit` collection is `allow read, write: if false` in
 * firestore.rules, so the client SDK could never implement them honestly. They
 * are reached through the Admin SDK, which bypasses rules — which is exactly why
 * they must go through an interface rather than a direct firebase-admin import.
 */
export interface AuditAdapter {
  /** Records one MCP tool call. Shared by both products' tools. */
  addAuditEntry(userId: string, entry: McpAuditEntry): Promise<void>
}
