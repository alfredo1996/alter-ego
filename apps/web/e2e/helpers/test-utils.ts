import type { Page } from "@playwright/test"

let counter = 0
export function uniqueName(base: string): string {
  return `${base} ${Date.now().toString(36)}${(counter++).toString(36)}`
}

export async function signIn(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email").fill("test@example.com")
  await page.getByLabel("Password", { exact: true }).fill("password123")
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL("/dashboard")
}

export async function navigateTo(page: Page, linkName: string, url: string) {
  // The sidebar's link: not a same-named link in the page.
  const sidebarLink = page.locator("aside").getByRole("link", { name: linkName })
  const mobileMenuButton = page.getByRole("button", { name: /open navigation/i })

  // Wait for either sidebar or mobile nav button to be visible
  await Promise.race([
    sidebarLink.waitFor({ state: "visible", timeout: 5000 }).catch(() => {}),
    mobileMenuButton.waitFor({ state: "visible", timeout: 5000 }).catch(() => {}),
  ])

  const isSidebarVisible = await sidebarLink.isVisible().catch(() => false)

  if (isSidebarVisible) {
    await sidebarLink.click()
  } else {
    await mobileMenuButton.click()
    await page.getByRole("link", { name: linkName }).click()
  }
  await page.waitForURL(url)
}
