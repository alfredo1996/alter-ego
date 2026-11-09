/**
 * The nav table drives both the sidebar and route access, so these assertions are
 * the contract that a feature flag actually closes the URL and not just the link.
 */

import { describe, expect, it, vi } from "vitest"

import { homeRoute, isOnRoute, isRouteEnabled, visibleNavGroups } from "../nav"

/**
 * The nav table is icon-agnostic and nothing here asserts on icons, but
 * lucide-react is ~3,900 modules. Any icon name resolves to the same inert component.
 */
vi.mock("lucide-react", () => {
  const Icon = () => null
  return new Proxy(
    { __esModule: true },
    {
      get: (target, name) => {
        if (name in target) return Reflect.get(target, name)
        // `then` must stay undefined: a module namespace with a callable `then`
        // looks like a thenable, and `await import()` never resolves.
        if (name === "then" || typeof name === "symbol") return undefined
        return Icon
      },
      // Vitest checks that each imported name exists on the mock before it reads
      // it, and that check does not go through `get`.
      has: (_target, name) => name !== "then" && typeof name !== "symbol",
    },
  )
})

describe("nav", () => {
  it.each([
    ["/dashboard", true],
    ["/transactions", true],
    ["/accounts/some-account-id", true],
    ["/budgets", true],
    ["/goals", true],
    ["/recurring", true],
    ["/reports", true],
    ["/settings", true],
    // Routes the nav does not declare fall through to Next's 404.
    ["/does-not-exist", true],
  ])("isRouteEnabled(%s) === %s", (pathname, expected) => {
    expect(isRouteEnabled(pathname)).toBe(expected)
  })

  it("has one group, Personal, with every page in order", () => {
    expect(visibleNavGroups().map((g) => [g.label, g.items.map((i) => i.href)])).toEqual([
      [
        "Personal",
        ["/dashboard", "/accounts", "/transactions", "/categories", "/budgets", "/goals", "/recurring", "/reports"],
      ],
    ])
  })

  it("sends blocked routes to the dashboard", () => {
    expect(homeRoute()).toBe("/dashboard")
  })

  it.each([
    ["/accounts", "/accounts", true],
    ["/accounts/a1", "/accounts", true],
    // A shared prefix is not a match.
    ["/accountsx", "/accounts", false],
  ])("isOnRoute(%s, %s) === %s", (pathname, href, expected) => {
    expect(isOnRoute(pathname, href)).toBe(expected)
  })
})
