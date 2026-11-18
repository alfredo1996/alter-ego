import { CategoriesPage } from "@alter-ego/finance/pages/categories-page"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Categories | Alter Ego",
}

export default function Route() {
  return <CategoriesPage />
}
