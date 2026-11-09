"use client"

import { useEffect, useRef, useState } from "react"

import { getBackend } from "@/lib/backend"
import { useSettingsStore } from "@/stores/settings-store"

import type { Category } from "@/types"

/**
 * Debounced category suggestion based on transaction description.
 * Tries rule-based categorization first, then falls back to AI if enabled.
 */
export function useCategorySuggestion(
  description: string,
  transactionType: string,
  categories: Category[],
  userId: string | undefined,
) {
  const aiMode = useSettingsStore((s) => s.aiMode)
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear on short/empty description or transfer type — derived, no effect needed
  const shouldSkip = transactionType === "transfer" || !description || description.length < 3

  useEffect(() => {
    if (shouldSkip) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const ruleResult = userId
          ? await getBackend().db.applyCategorization(userId, description)
          : null
        if (ruleResult && categories.some((c) => c.id === ruleResult)) {
          setSuggestedCategoryId(ruleResult)
          return
        }
        if (aiMode !== "off") {
          const aiResult = await getBackend().ai.categorize(description)
          if (aiResult && categories.some((c) => c.id === aiResult.categoryId)) {
            setSuggestedCategoryId(aiResult.categoryId)
            return
          }
        }
        setSuggestedCategoryId(null)
      } catch {
        setSuggestedCategoryId(null)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [description, shouldSkip, aiMode, categories, userId])

  // Derive the effective suggestion: null when we should skip
  const effectiveId = shouldSkip ? null : suggestedCategoryId

  return { suggestedCategoryId: effectiveId, clearSuggestion: () => setSuggestedCategoryId(null) }
}
