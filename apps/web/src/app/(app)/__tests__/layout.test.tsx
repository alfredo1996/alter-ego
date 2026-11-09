import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/auth/auth-guard", () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => children }))
vi.mock("@/components/route-guard", () => ({ RouteGuard: ({ children }: { children: React.ReactNode }) => children }))
vi.mock("@/components/app-sidebar", () => ({ AppSidebar: () => null }))
vi.mock("@/components/mobile-nav", () => ({ MobileNav: () => null }))
vi.mock("@/components/import-progress-indicator", () => ({ ImportProgressIndicator: () => null }))
vi.mock("@/components/quick-add-fab", () => ({ QuickAddFab: () => <button aria-label="New Transaction" /> }))

import AppLayout from "../layout"

describe("app layout and the quick-add button", () => {
  it("shows the quick-add button with no bottom padding for it (it sits in the top bar)", () => {
    render(<AppLayout>page</AppLayout>)
    expect(screen.getByRole("button", { name: "New Transaction" })).toBeInTheDocument()
    expect(screen.getByRole("main").className).not.toMatch(/pb-24/)
  })

  it("puts every page in one centred column, 1120px at most", () => {
    render(<AppLayout>page</AppLayout>)
    expect(screen.getByText("page")).toHaveClass("mx-auto", "w-full", "max-w-[1120px]")
  })
})
