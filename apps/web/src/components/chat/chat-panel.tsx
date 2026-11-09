"use client"

import { Button } from "@alter-ego/ui/ui/button"
import { Input } from "@alter-ego/ui/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@alter-ego/ui/ui/sheet"
import { cn } from "@alter-ego/ui/utils"
import { format } from "date-fns"
import { MessageSquare, X, Send } from "lucide-react"
import { useState, useRef, useEffect } from "react"


import { useAuth } from "@/hooks/use-auth"
import { useChat } from "@/hooks/use-chat"


interface ChatPanelProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ChatPanel({ isOpen, onOpenChange }: ChatPanelProps) {
  const { user } = useAuth()
  const { messages, isLoading, sendMessage, isEnabled } = useChat(user?.id)
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function handleSend() {
    const content = input.trim()
    if (!content || isLoading) return
    setInput("")
    sendMessage(content)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[360px] flex-col p-0 sm:w-[400px]">
        <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <SheetTitle className="text-base">AI Assistant</SheetTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </SheetHeader>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {!isEnabled ? (
            <div className="rounded-lg border border-muted bg-muted/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium">AI features are disabled.</p>
              <p className="mt-1">
                Go to Settings → AI Features and choose a mode to enable the assistant.
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-40" />
              <p>Ask me anything about your finances.</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col gap-1",
                  msg.role === "user" ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {format(msg.timestamp, "HH:mm")}
                </span>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex items-start">
              <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isEnabled ? "Message AI Assistant..." : "Enable AI to chat"}
              disabled={!isEnabled || isLoading}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!isEnabled || isLoading || !input.trim()}
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
