/**
 * Firebase adapter contract tests — runs against the Firebase Emulator Suite.
 *
 * Requires (run before `pnpm test:firebase`):
 *   firebase emulators:start --only auth,firestore
 *
 * The vitest.emulator.ts config handles:
 *  - Setting fake NEXT_PUBLIC_FIREBASE_* env vars
 *  - Connecting the SDK to localhost:9099 (Auth) and localhost:8080 (Firestore)
 *  - Clearing all emulator data before the test run
 */
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth"
import { addDoc, collection, doc, getDocs, setDoc, Timestamp } from "firebase/firestore"

import { createFirebaseAdapter } from "@/lib/backend/firebase"
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase-client"

import { describeAdapterContract } from "./adapter-contract"

describeAdapterContract("firebase", async () => {
  const email = `contract-${Date.now()}@example.com`
  const password = "Test1234!"

  const auth = getFirebaseAuth()
  const { user } = await createUserWithEmailAndPassword(auth, email, password)

  const adapter = createFirebaseAdapter()

  return {
    db: adapter.db,
    userId: user.uid,
    otherUserId: "nonexistent-user-isolation-test",
    legacyBalanceSnapshots: {
      seed: async () => {
        await addDoc(collection(getFirebaseDb(), `users/${user.uid}/account_balance_snapshots`), {
          userId: user.uid, accountId: "gone", balance: 100, date: new Date(), createdAt: new Date(),
        })
      },
      count: async () =>
        (await getDocs(collection(getFirebaseDb(), `users/${user.uid}/account_balance_snapshots`))).size,
    },
    seedNetWorthSnapshot: async (date, netWorth) => {
      const id = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      await setDoc(doc(getFirebaseDb(), `users/${user.uid}/net_worth_snapshots/${id}`), {
        userId: user.uid, date: Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth(), date.getDate())),
        totalAssets: netWorth, totalLiabilities: 0, netWorth,
      })
    },
    cleanup: async () => {
      // Delete the test user — Firestore subcollection docs are cleaned by
      // the globalSetup teardown at the end of the full run
      await deleteUser(user).catch(() => {})
    },
  }
})
