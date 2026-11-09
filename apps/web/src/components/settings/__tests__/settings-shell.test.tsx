import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useSettingsStore } from "@/stores/settings-store"

import { SettingsShell } from "../settings-shell"

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "a@example.com", displayName: "Dana" }, loading: false, refreshUser: vi.fn() }),
}))
const load = vi.hoisted(() => ({ tx: { data: { total: 88 } as { total: number } | undefined, isLoading: false }, cats: { isLoading: false } as { isLoading: boolean; data?: unknown[] } }))
vi.mock("@/hooks/use-transactions", () => ({
  useTransactions: () => load.tx,
  useDeleteAllTransactions: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock("@/hooks/use-accounts", () => ({ useDeleteAllAccountData: () => ({ mutate: vi.fn() }) }))
vi.mock("@/hooks/use-categories", () => ({
  useCategories: () => ({ data: [{ id: "c1", name: "Groceries", isDefault: true, userId: null }], ...load.cats }),
  useDeleteAllCategories: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock("@alter-ego/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/settings/tags-section", () => ({ TagsSection: () => null }))
vi.mock("@/components/settings/categorization-rules-section", () => ({ CategorizationRulesSection: () => null }))
vi.mock("@/components/settings/api-keys-section", () => ({ ApiKeysSection: () => null }))
vi.mock("@/components/settings/connectors-section", () => ({ ConnectorsSection: () => null }))
vi.mock("@/components/settings/data-export-section", () => ({ DataExportSection: () => null }))

describe("SettingsShell", () => {
  beforeEach(() => {
    load.tx = { data: { total: 88 }, isLoading: false }
    load.cats = { isLoading: false }
    useSettingsStore.setState({ defaultCurrency: "USD", theme: "system" })
  })

  it("chooses the currency with a segmented EUR / USD / GBP, Other opening the rest", () => {
    render(<SettingsShell />)
    const group = screen.getByRole("group", { name: "Currency" })
    expect(within(group).getByRole("button", { name: "USD" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(group).getByRole("button", { name: "GBP" }))
    expect(useSettingsStore.getState().defaultCurrency).toBe("GBP")
    expect(within(group).getByRole("button", { name: "GBP" })).toHaveAttribute("aria-pressed", "true")
    expect(within(group).getByRole("combobox", { name: "Other currency" })).toBeInTheDocument()
  })

  it("gives every section its own heading and an index link to it", () => {
    render(<SettingsShell />)
    const index = screen.getByRole("navigation", { name: "On this page" })
    for (const name of ["Profile", "Preferences", "Categories & Tags", "Data", "Danger Zone"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument()
      expect(within(index).getByRole("link", { name })).toBeInTheDocument()
    }
  })

  it("orders the sections Profile, Preferences, Categories and Tags", () => {
    render(<SettingsShell />)
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
    expect(headings.slice(0, 3)).toEqual(["Profile", "Preferences", "Categories & Tags"])
  })

  it("says 'Nothing to reset' in place of a Reset Categories button when no custom category exists", () => {
    render(<SettingsShell />)
    expect(screen.getByText("Nothing to reset")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /reset categories/i })).toBeNull()
    expect(screen.getByRole("button", { name: "Delete All Transactions (88)" })).toBeEnabled()
  })

  it("counts a built-in the user edited as one to reset", () => {
    load.cats = { isLoading: false, data: [{ id: "c1", name: "Food", isDefault: true, userId: "u1" }] }
    render(<SettingsShell />)
    expect(screen.getByRole("button", { name: "Reset Categories to Default (1)" })).toBeEnabled()
  })

  it("states no count in words while the counts load", () => {
    load.tx = { data: undefined, isLoading: true }
    load.cats = { isLoading: true }
    render(<SettingsShell />)
    expect(screen.queryByText("Nothing to reset")).toBeNull()
    expect(screen.queryByText("Nothing to delete")).toBeNull()
    expect(screen.getByRole("button", { name: "Reset Categories to Default" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Delete All Transactions" })).toBeDisabled()
    expect(screen.getByText(/Removes all transactions\./)).toBeInTheDocument()
  })

  it("says 'Nothing to delete' in place of the button when there are no transactions", () => {
    load.tx = { data: { total: 0 }, isLoading: false }
    render(<SettingsShell />)
    expect(screen.getByText("Nothing to delete")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Delete All Transactions/ })).toBeNull()
  })
})
