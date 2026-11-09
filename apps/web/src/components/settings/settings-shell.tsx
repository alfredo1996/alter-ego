"use client"

import { OnThisPage } from "@alter-ego/ui/page/on-this-page"
import { PageHeader } from "@alter-ego/ui/page/page-header"
import { SegmentedButtons } from "@alter-ego/ui/page/segmented-buttons"
import { StatusPill } from "@alter-ego/ui/page/status-pill"
import { Button } from "@alter-ego/ui/ui/button"
import { Input } from "@alter-ego/ui/ui/input"
import { Label } from "@alter-ego/ui/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@alter-ego/ui/ui/select"
import { Skeleton } from "@alter-ego/ui/ui/skeleton"
import { useToast } from "@alter-ego/ui/use-toast"
import { cn } from "@alter-ego/ui/utils"
import { ArrowRight, Sun, Moon, Monitor, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { ApiKeysSection } from "@/components/settings/api-keys-section"
import { CategorizationRulesSection } from "@/components/settings/categorization-rules-section"
import { ConnectorsSection } from "@/components/settings/connectors-section"
import { DataExportSection } from "@/components/settings/data-export-section"
import { SettingsRow, SettingsSection } from "@/components/settings/settings-section"
import { TagsSection } from "@/components/settings/tags-section"
import { useDeleteAllAccountData } from "@/hooks/use-accounts"
import { useAuth } from "@/hooks/use-auth"
import { useCategories, useDeleteAllCategories } from "@/hooks/use-categories"
import { useTransactions, useDeleteAllTransactions } from "@/hooks/use-transactions"
import { getBackend } from "@/lib/backend"
import { currencyOptionsShort, localeOptions } from "@/lib/options"
import { useImportStore } from "@/stores/import-store"
import { useSettingsStore } from "@/stores/settings-store"

import type { AIMode, Currency } from "@/types"

const aiModeOptions: { value: AIMode; label: string; description: string }[] = [
  { value: "off", label: "Off", description: "No AI features" },
  { value: "local", label: "Local", description: "Your own API key" },
  { value: "cloud", label: "Cloud", description: "Cloud-powered AI" },
]

const MAIN_CURRENCIES: Currency[] = ["EUR", "USD", "GBP"]
const CURRENCY_SYMBOL: Record<string, string> = { EUR: "\u20ac", USD: "$", GBP: "\u00a3" }

const themeOptions = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
]

export function SettingsShell() {
  const { user, loading: authLoading, refreshUser } = useAuth()
  // Only the total is shown; one row keeps the read to a count, not the whole ledger.
  const { data: txResult, isLoading: txLoading } = useTransactions(user?.id, { limit: 1 })
  const transactionCount = txResult?.total ?? 0
  const {
    defaultCurrency,
    locale,
    theme,
    aiMode,
    setDefaultCurrency,
    setLocale,
    setTheme,
    setAIMode,
  } = useSettingsStore()
  const { toast } = useToast()

  const deleteAllTransactions = useDeleteAllTransactions(user?.id)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)

  const deleteAllAccountData = useDeleteAllAccountData(user?.id)
  const [wipeOpen, setWipeOpen] = useState(false)
  // One background job at a time: a running import or wipe owns the progress indicator.
  const backgroundBusy = useImportStore((s) => s.active !== null)

  const { data: categories, isLoading: categoriesLoading } = useCategories(user?.id)
  const customCategoryCount = categories?.filter((c) => !c.isDefault || c.userId !== null).length ?? 0
  const deleteAllCategories = useDeleteAllCategories(user?.id)
  const [resetCategoriesOpen, setResetCategoriesOpen] = useState(false)

  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDisplayName, setProfileDisplayName] = useState("")
  const [profileEmail, setProfileEmail] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)

  function startEditProfile() {
    setProfileDisplayName(user?.displayName ?? "")
    setProfileEmail(user?.email ?? "")
    setEditingProfile(true)
  }

  async function saveProfile() {
    setSavingProfile(true)
    try {
      await getBackend().auth.updateProfile({
        displayName: profileDisplayName,
        email: profileEmail || undefined,
      })
      await refreshUser()
      toast({ title: "Profile updated" })
      setEditingProfile(false)
    } catch (err) {
      toast({
        title: "Failed to update profile",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSavingProfile(false)
    }
  }

  if (authLoading) {
    return (
      <div>
        <Skeleton className="mb-6 h-8 w-32" />
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </div>
    )
  }

  const isOtherCurrency = !MAIN_CURRENCIES.includes(defaultCurrency)
  const today = new Date()
  const formatHint = `Dates read ${today.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}; amounts ${new Intl.NumberFormat(locale, { style: "currency", currency: defaultCurrency }).format(1488.93)}.`

  const sections = [
    { id: "profile", label: "Profile" },
    { id: "preferences", label: "Preferences" },
    { id: "sorting", label: "Categories & Tags" },
    { id: "data", label: "Data" },
    { id: "danger", label: "Danger Zone" },
  ]

  return (
    <div>
      <PageHeader className="mb-6" title="Settings" subtitle="Your profile, preferences and data." />

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
        <OnThisPage items={sections} aria-label="On this page" />

        <div className="flex min-w-0 max-w-[720px] flex-1 flex-col gap-11">
          <SettingsSection
            id="profile"
            title="Profile"
            description="How you appear in the app."
            actions={
              !editingProfile && (
                <Button variant="outline" size="lg" onClick={startEditProfile}>
                  <Pencil />
                  Edit
                </Button>
              )
            }
          >
            {editingProfile ? (
              <SettingsRow label="Your details" stacked>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name">Display Name</Label>
                    <Input
                      id="profile-name"
                      value={profileDisplayName}
                      onChange={(e) => setProfileDisplayName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-email">Email</Label>
                    <Input
                      id="profile-email"
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveProfile} disabled={savingProfile}>
                      {savingProfile ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditingProfile(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </SettingsRow>
            ) : (
              <>
                <SettingsRow label="Display Name">
                  <span className="text-[15px] text-foreground">{user?.displayName ?? "Not set"}</span>
                </SettingsRow>
                <SettingsRow label="Email" hint="You sign in with this address.">
                  <span className="min-w-0 break-all text-[15px] text-foreground">{user?.email ?? "Not signed in"}</span>
                </SettingsRow>
              </>
            )}
          </SettingsSection>

          <SettingsSection id="preferences" title="Preferences" description="How the app looks, counts and helps.">
            <SettingsRow label="Theme" labelId="theme-label" hint="System follows your device.">
              <SegmentedButtons
                aria-labelledby="theme-label"
                value={theme}
                onChange={setTheme}
                options={themeOptions.map(({ value, label, icon: Icon }) => ({ value, label, icon: <Icon aria-hidden className="size-[15px]" /> }))}
              />
            </SettingsRow>
            <SettingsRow label="Currency" labelId="currency-label" hint="For totals and new accounts. Each account keeps its own.">
              <SegmentedButtons
                aria-labelledby="currency-label"
                value={isOtherCurrency ? "" : defaultCurrency}
                onChange={(value) => setDefaultCurrency(value as Currency)}
                options={MAIN_CURRENCIES.map((c) => ({ value: c as string, label: c, icon: <span aria-hidden>{CURRENCY_SYMBOL[c]}</span> }))}
                trailing={
                  <Select value={isOtherCurrency ? defaultCurrency : ""} onValueChange={(value) => setDefaultCurrency(value as Currency)}>
                    <SelectTrigger
                      aria-label="Other currency"
                      className={cn(
                        "h-auto min-h-[38px] w-auto gap-1 rounded-lg border-0 px-3 py-0 text-[13px] shadow-none pointer-coarse:min-h-11",
                        isOtherCurrency ? "bg-background font-medium shadow-xs" : "bg-transparent text-subtle-foreground data-[placeholder]:text-subtle-foreground",
                      )}
                    >
                      <SelectValue placeholder="Other" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptionsShort
                        .filter((o) => !MAIN_CURRENCIES.includes(o.value))
                        .map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.value}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                }
              />
            </SettingsRow>
            <SettingsRow label="Language and Format" htmlFor="locale" hint={formatHint}>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger id="locale" className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {localeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
            <SettingsRow label="AI Features" labelId="ai-label" hint="AI is optional. Everything in the app works without it." stacked>
              <SegmentedButtons aria-labelledby="ai-label" value={aiMode} onChange={setAIMode} options={aiModeOptions} />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection id="sorting" title="Categories & Tags" description="Sort transactions without doing it by hand.">
            <SettingsRow label="Categories" hint="Rename, recolour and group them on their own page.">
              <Button variant="outline" size="lg" asChild>
                <Link href="/categories">
                  Open Categories
                  <ArrowRight />
                </Link>
              </Button>
            </SettingsRow>
            <TagsSection userId={user?.id} />
            <CategorizationRulesSection userId={user?.id} transactionCount={txLoading ? undefined : transactionCount} />
          </SettingsSection>

          <SettingsSection id="data" title="Data" description="Take your data with you, or let your own tools read it.">
            <DataExportSection />
            <ApiKeysSection userId={user?.id} />
            <ConnectorsSection />
          </SettingsSection>

          <SettingsSection id="danger" title="Danger Zone" description="Each action asks you to confirm, and none can be undone." danger>
            <SettingsRow
              label="Delete All Transactions"
              hint={`Removes all ${txLoading ? "" : `${transactionCount} `}transactions. Accounts, categories, budgets and rules stay.`}
            >
              {!txLoading && transactionCount === 0 ? (
                <StatusPill>Nothing to delete</StatusPill>
              ) : (
                <Button variant="outline-destructive" size="lg" disabled={txLoading} onClick={() => setDeleteAllOpen(true)}>
                  <Trash2 />
                  Delete All Transactions{txLoading ? "" : ` (${transactionCount})`}
                </Button>
              )}
            </SettingsRow>
            <SettingsRow
              label="Start from Zero"
              hint="Deletes every account and transaction, with recurring rules and balance history. Categories, tags, budgets and rules stay. It runs in the background."
            >
              <Button variant="outline-destructive" size="lg" disabled={backgroundBusy} onClick={() => setWipeOpen(true)}>
                <Trash2 />
                Delete All Accounts &amp; Transactions
              </Button>
            </SettingsRow>
            <SettingsRow label="Reset Categories" hint="Deletes the categories you made, undoes your edits to the defaults and brings back the default set.">
              {!categoriesLoading && customCategoryCount === 0 ? (
                <StatusPill>Nothing to reset</StatusPill>
              ) : (
                <Button variant="outline-destructive" size="lg" disabled={categoriesLoading} onClick={() => setResetCategoriesOpen(true)}>
                  <Trash2 />
                  Reset Categories to Default{categoriesLoading ? "" : ` (${customCategoryCount})`}
                </Button>
              )}
            </SettingsRow>
          </SettingsSection>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        title="Delete All Transactions"
        description={`Are you sure you want to delete all ${transactionCount} transactions? This action cannot be undone. Account balances will be reset.`}
        onConfirm={() => {
          deleteAllTransactions.mutate(undefined, {
            onSuccess: () => {
              setDeleteAllOpen(false)
              toast({ title: "All transactions deleted" })
            },
          })
        }}
        isPending={deleteAllTransactions.isPending}
      />

      <ConfirmDeleteDialog
        open={wipeOpen}
        onOpenChange={setWipeOpen}
        title="Delete All Accounts & Transactions"
        description="Every account, transaction, recurring transaction and balance history entry will be deleted, bringing all balances to zero. This cannot be undone."
        confirmLabel="Delete everything"
        onConfirm={() => {
          setWipeOpen(false)
          deleteAllAccountData.mutate()
        }}
        isPending={false}
      />

      <ConfirmDeleteDialog
        open={resetCategoriesOpen}
        onOpenChange={setResetCategoriesOpen}
        title="Reset Categories to Default"
        description={`Are you sure you want to delete all ${customCategoryCount} custom or edited categories? The default categories will remain, as they were before you edited them. Transactions keep their data but lose any custom-category assignment. This cannot be undone.`}
        onConfirm={() => {
          deleteAllCategories.mutate(undefined, {
            onSuccess: () => {
              setResetCategoriesOpen(false)
              toast({ title: "Categories reset to default" })
            },
          })
        }}
        isPending={deleteAllCategories.isPending}
      />
  </div>
)
}
