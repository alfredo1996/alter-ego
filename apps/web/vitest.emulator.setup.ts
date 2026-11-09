/**
 * Vitest setup file for Firebase emulator tests.
 * Runs inside the worker process before each test file.
 *
 * Env vars are already set by the vitest.emulator.ts config `env` option.
 * Default categories are seeded by the globalSetup (bypasses Security Rules).
 * Here we only connect the Firebase SDK to local emulators.
 */
import { emulatorHosts } from "@/lib/backend/__tests__/emulator-hosts"
import { configureForEmulator } from "@/lib/firebase-client"

const hosts = emulatorHosts()

// Route the Admin SDK to the emulator too. Without these it falls through to
// Application Default Credentials and tries to reach production Firestore, which
// surfaces as multi-second timeouts rather than a clear error.
process.env.FIRESTORE_EMULATOR_HOST = hosts.firestore
process.env.FIREBASE_AUTH_EMULATOR_HOST = hosts.auth

// Must be called before any Firestore or Auth operation
const hostOf = (hostPort: string) => hostPort.slice(0, hostPort.lastIndexOf(":"))
configureForEmulator({
  authPort: hosts.authPort,
  firestorePort: hosts.firestorePort,
  authHost: hostOf(hosts.auth),
  firestoreHost: hostOf(hosts.firestore),
})
