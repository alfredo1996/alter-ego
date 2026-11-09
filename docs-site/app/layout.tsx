import type { Metadata } from "next"
import type { ReactNode } from "react"

import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Alter Ego Docs", template: "%s · Alter Ego Docs" },
  description:
    "Documentation for Alter Ego — a personal finance app with a swappable backend, a REST API and an MCP server.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
