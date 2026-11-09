"use client"

import { PageLoader } from "@alter-ego/ui/page/page-state"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuth } from "@/hooks/use-auth"

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/dashboard")
      } else {
        router.replace("/login")
      }
    }
  }, [user, loading, router])

  return <PageLoader />
}
