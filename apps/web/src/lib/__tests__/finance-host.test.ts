import { categorize } from "@alter-ego/finance/host"
import { afterEach, describe, expect, it, vi } from "vitest"

import { getBackend } from "@/lib/backend"
import { useSettingsStore } from "@/stores/settings-store"

afterEach(() => {
  vi.restoreAllMocks()
  useSettingsStore.setState({ aiMode: "off" })
})

describe("the host's categorizer", () => {
  const suggestion = { categoryId: "food", confidence: 0.8 }

  it.each([
    ["off", null, 0],
    ["local", suggestion, 1],
    ["cloud", suggestion, 1],
  ] as const)("with AI %s it answers %j after %i backend calls", async (aiMode, expected, calls) => {
    const ask = vi.spyOn(getBackend().ai, "categorize").mockResolvedValue(suggestion)
    useSettingsStore.setState({ aiMode })
    await expect(categorize("Corner cafe")).resolves.toEqual(expected)
    expect(ask).toHaveBeenCalledTimes(calls)
  })
})
