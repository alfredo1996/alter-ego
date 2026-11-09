/**
 * The navigation table — the single source of truth for both what the sidebar
 * renders and which routes are reachable.
 *
 * Keeping these together is deliberate: a feature flag that only hides links
 * leaves the route reachable by typing the URL, so `/budgets` used to stay open
 * with `budgets: false`. `isRouteEnabled` reads the same table the nav does, so a
 * flag flip can never disagree with what the guard enforces.
 */

import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Tags,
  BarChart3,
  PiggyBank,
  CalendarClock,
  Target,
  Settings,
} from "lucide-react"

import { features } from "./features"

import type { LucideIcon } from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  featureFlag?: keyof typeof features
}

export interface NavGroup {
  label: string
  featureFlag?: keyof typeof features
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Personal",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Accounts", href: "/accounts", icon: Wallet },
      { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
      { label: "Categories", href: "/categories", icon: Tags },
      { label: "Budgets", href: "/budgets", icon: PiggyBank, featureFlag: "budgets" },
      { label: "Goals", href: "/goals", icon: Target, featureFlag: "savingsGoals" },
      { label: "Recurring", href: "/recurring", icon: CalendarClock, featureFlag: "recurring" },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
]

function isGroupEnabled(group: NavGroup): boolean {
  return !group.featureFlag || features[group.featureFlag]
}

/** The item's own page or one under it (an account's page lights Accounts). */
export function isOnRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}

function isItemEnabled(item: NavItem): boolean {
  return !item.featureFlag || features[item.featureFlag]
}

/** Nav groups to render for the current mode, with disabled items and empty groups dropped. */
/**
 * Pinned below the groups rather than inside one. Both the sidebar and the
 * mobile sheet render it: for a while only the sidebar did, which left the
 * settings page unreachable from a phone.
 */
export const BOTTOM_ITEMS: NavItem[] = [{ label: "Settings", href: "/settings", icon: Settings }]

export function visibleNavGroups(): NavGroup[] {
  return NAV_GROUPS.filter(isGroupEnabled)
    .map((group) => ({ ...group, items: group.items.filter(isItemEnabled) }))
    .filter((group) => group.items.length > 0)
}

/**
 * Whether a route may be opened. Routes the nav doesn't declare are allowed through
 * so Next's own 404 handles them — this gates the nav table, not the whole router.
 */
export function isRouteEnabled(pathname: string): boolean {
  // Settings is never gated.
  if (pathname === "/settings") return true

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (!isOnRoute(pathname, item.href)) continue
      return isGroupEnabled(group) && isItemEnabled(item)
    }
  }

  return true
}

/**
 * First route the current mode can actually open — the redirect target for a
 * blocked route. Derived from the table rather than hardcoded, so it follows the
 * nav as pages are added and removed.
 */
export function homeRoute(): string {
  return visibleNavGroups()[0]?.items[0]?.href ?? "/settings"
}
