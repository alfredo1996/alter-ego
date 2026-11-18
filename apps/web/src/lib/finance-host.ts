"use client"

import { provideFinanceHost } from "@alter-ego/finance/host"

import { useAuth } from "@/hooks/use-auth"
import { getBackend } from "@/lib/backend"
import { useSettingsStore } from "@/stores/settings-store"

// The one place the app hands finance its services: data, the signed-in user and the AI categorizer. Imported by the providers (and the vitest
// setup) so it runs before any finance component renders.
provideFinanceHost({
  getBackend,
  useAuth,
  // AI is optional: with the mode off nothing is asked, and nothing is suggested.
  categorize: async (description) =>
    useSettingsStore.getState().aiMode === "off" ? null : getBackend().ai.categorize(description),
})
