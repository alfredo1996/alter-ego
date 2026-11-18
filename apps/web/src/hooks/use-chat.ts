"use client"

import { useState, useCallback } from "react"

import { getBackend } from "@/lib/backend"
import { useSettingsStore } from "@/stores/settings-store"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export function useChat(userId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const aiMode = useSettingsStore((s) => s.aiMode)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!userId || aiMode === "off") return

      const userMessage: ChatMessage = {
        role: "user",
        content,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      try {
        const backend = getBackend()
        const response = await backend.ai.chat(userId, content)
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: response,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      } catch {
        const errorMessage: ChatMessage = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
      }
    },
    [userId, aiMode]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    isEnabled: aiMode !== "off",
  }
}
