"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { AIMode } from "@/types"

// The app's own settings. Currency and locale are finance's (useFinanceSettingsStore); they once lived
// here, so an older stored value still carries them. Zustand's merge keeps keys it does not know and the
// finance store reads them once, so no `version` or `partialize` here: neither may drop them first.
interface SettingsState {
  aiMode: AIMode
  theme: "light" | "dark" | "system"

  setAIMode: (mode: AIMode) => void
  setTheme: (theme: "light" | "dark" | "system") => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      aiMode: "off",
      theme: "system",

      setAIMode: (aiMode) => set({ aiMode }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "alter-ego-settings",
    }
  )
)
