"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { AIMode, Currency } from "@/types"

interface SettingsState {
  aiMode: AIMode
  defaultCurrency: Currency
  locale: string
  theme: "light" | "dark" | "system"

  setAIMode: (mode: AIMode) => void
  setDefaultCurrency: (currency: Currency) => void
  setLocale: (locale: string) => void
  setTheme: (theme: "light" | "dark" | "system") => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      aiMode: "off",
      defaultCurrency: "USD",
      locale: "en-US",
      theme: "system",

      setAIMode: (aiMode) => set({ aiMode }),
      setDefaultCurrency: (defaultCurrency) => set({ defaultCurrency }),
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "alter-ego-settings",
    }
  )
)
