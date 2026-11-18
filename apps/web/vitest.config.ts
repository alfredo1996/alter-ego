import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Pin the timezone so date tests are deterministic: this app stores dates as
// local midnight, so a UTC runner would silently pass tests that assert
// local-vs-UTC calendar-day behaviour. Override with TZ=... to check other zones.
process.env.TZ ||= "Europe/Rome";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    // A page-sized render takes ~0.5 s alone but 10x that when three modes and other worktrees share
    // the machine, and the default 5 s then fails green tests. 30 s still fails a real hang.
    testTimeout: 30_000,
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}", "../../packages/*/src/**/*.test.{ts,tsx}", "../../packages/modules/*/src/**/*.test.{ts,tsx}"],
    // Emulator-only integration tests (run via vitest.emulator.ts, not here).
    exclude: [
      "src/lib/backend/__tests__/firebase.adapter.test.ts",
      "src/lib/backend/__tests__/firebase.freshness.test.ts",
      "src/lib/backend/__tests__/firebase.dashboard.test.ts",
      "src/lib/backend/__tests__/firebase.budgets.test.ts",
      "src/lib/backend/__tests__/firebaseadmin.adapter.test.ts",
      "src/lib/backend/__tests__/firebase.api-keys.test.ts",
      "src/lib/backend/__tests__/firestore-rules.test.ts",
      "src/lib/backend/__tests__/firestore-rules-owner.test.ts",
      "src/lib/oauth/__tests__/flow.emulator.test.ts",
      "src/lib/mcp/__tests__/finance-read.emulator.test.ts",
      "src/lib/mcp/__tests__/finance-write.emulator.test.ts",
    ],
    setupFiles: ["./vitest.setup.ts", "./vitest.finance-host.setup.ts"],
    coverage: {
      provider: "v8",
      // the kernel and UI helpers live outside apps/web
      allowExternal: true,
      reporter: ["text", "json", "html"],
      include: [
        "src/**/*.{ts,tsx}",
        // The shared helpers that moved out of src/ (the UI kit's components stay Playwright-covered)
        "../../packages/kernel/src/**/*.ts",
        "../../packages/ui/src/utils.ts",
        "../../packages/ui/src/use-toast.ts",
        // The finance package: what src/ counted before it moved out
        "../../packages/modules/*/src/**/*.{ts,tsx}",
      ],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "**/packages/*/src/**/__tests__/**",
        "src/types/**",
        // Same carve-outs for the packages' modules: types and schemas, UI and pages, hooks and stores
        "**/packages/modules/*/src/types.ts",
        "**/packages/modules/*/src/schemas.ts",
        "**/packages/modules/*/src/adapter.ts",
        "**/packages/modules/*/src/components/**",
        "**/packages/modules/*/src/pages/**",
        "**/packages/modules/*/src/hooks/**",
        "**/packages/modules/*/src/stores/**",
        "**/packages/modules/*/src/lib/options.ts",
        // The settings sections and the floating buttons are UI too
        "**/packages/modules/*/src/settings.tsx",
        "**/packages/modules/*/src/overlays.tsx",
        // React UI — covered by Playwright E2E tests
        "src/components/**",
        // Pages and layouts; src/app/api/** (the route handlers) counts
        "src/app/*.{ts,tsx}",
        "src/app/[(]app[)]/**",
        "src/app/[(]auth[)]/**",
        "src/app/[[]lang]/**",
        "src/app/.well-known/**",
        "src/app/api-docs/**",
        "src/app/oauth/**",
        // Pure Firestore I/O — exercised by the OAuth flow emulator tests
        "src/lib/oauth/store.ts",
        // Firestore I/O tool handlers — exercised by the MCP emulator tests
        "**/packages/modules/*/src/mcp/finance-read.ts",
        "**/packages/modules/*/src/mcp/finance-write.ts",
        // React hooks — require provider setup; business logic tested via adapters
        "src/hooks/**",
        // External service adapters — require live connections
        "src/lib/backend/firebase.ts",
        "src/lib/backend/firebase-admin.ts",
        "**/packages/modules/*/src/adapter-firebase.ts",
        "**/packages/modules/*/src/adapter-admin.ts",
        "src/lib/firebase-admin-client.ts",
        // Runtime-only: env validation and adapter selector singleton
        "src/lib/env.ts",
        "src/lib/backend/index.ts",
        "src/lib/backend/server-db.ts",
        // Pure TypeScript interface declarations (no executable statements)
        "src/lib/backend/types.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
