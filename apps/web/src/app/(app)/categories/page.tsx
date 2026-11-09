import { CategoriesShell } from "@/components/categories/categories-shell"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Categories | Alter Ego",
}

export default function CategoriesPage() {
  return <CategoriesShell />
}
