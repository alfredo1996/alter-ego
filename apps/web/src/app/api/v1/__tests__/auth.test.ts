import { NextRequest } from "next/server"
import { beforeAll, describe, expect, it } from "vitest"

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

// Every route.ts under /api/v1, found by glob: a new route joins this table by existing.
const modules = import.meta.glob<Record<string, unknown>>("../**/route.ts")
const routes = Object.keys(modules).sort()

// Each route is a cold dynamic import (6.9 s at load ~200). Load them all here, outside the
// per-test 5 s, so a test times out only on a real hang, not on the machine being busy.
beforeAll(async () => {
  await Promise.all(Object.values(modules).map((load) => load()))
}, 120_000)

const bearers: [string, Record<string, string>][] = [
  ["no Authorization header", {}],
  ["a non-Bearer scheme", { authorization: "Basic abc" }],
  ["an unknown key", { authorization: "Bearer not-a-real-key" }],
]

describe("/api/v1 requires an API key", () => {
  it("finds the routes", () => {
    expect(routes.length).toBeGreaterThanOrEqual(11)
  })

  for (const dir of routes) {
    describe(dir.slice(3, -"/route.ts".length), () => {
      it.each(bearers)("answers 401 on every method with %s", async (_n, headers) => {
        const mod = await modules[dir]()
        const handlers = METHODS.filter((m) => typeof mod[m] === "function")
        expect(handlers.length).toBeGreaterThan(0)
        for (const m of handlers) {
          const req = new NextRequest(`http://localhost/api/v1/${dir.slice(3, -"/route.ts".length)}`, { method: m, headers })
          const res = await (mod[m] as (r: NextRequest, c: unknown) => Promise<Response>)(req, {
            params: Promise.resolve({ id: "x" }),
          })
          expect([m, res.status]).toEqual([m, 401])
        }
      })
    })
  }
})
