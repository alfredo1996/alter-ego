"use client"

import { provideFinanceHost } from "@alter-ego/finance/host"

import { useAuth } from "@/hooks/use-auth"
import { getBackend } from "@/lib/backend"

// The one place the app hands finance its two services. Imported by the providers (and the vitest
// setup) so it runs before any finance component renders.
provideFinanceHost({ getBackend, useAuth })
