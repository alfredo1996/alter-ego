import { createFirebaseFinance, plainOffline } from "@alter-ego/finance/adapter-firebase"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  updateProfile as fbUpdateProfile,
  updateEmail,
  type User as FirebaseUser,
} from "firebase/auth"
import { collection, getDocsFromServer, Timestamp, type DocumentData } from "firebase/firestore"

import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase-client"

import type { BackendAdapter, AuthAdapter, DatabaseAdapter, AIAdapter } from "./types"
import type { User } from "@/types"

function mapFirebaseUser(u: FirebaseUser): User {
  return {
    id: u.uid,
    email: u.email ?? "",
    displayName: u.displayName ?? null,
    photoURL: u.photoURL ?? null,
    createdAt: new Date(u.metadata.creationTime ?? Date.now()),
    updatedAt: new Date(u.metadata.lastSignInTime ?? Date.now()),
  }
}

function createFirebaseAuthAdapter(): AuthAdapter {
  return {
    async signIn(email: string, password: string): Promise<User> {
      const auth = getFirebaseAuth()
      const { user } = await signInWithEmailAndPassword(auth, email, password)
      return mapFirebaseUser(user)
    },

    async signUp(email: string, password: string, displayName: string): Promise<User> {
      const auth = getFirebaseAuth()
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await fbUpdateProfile(user, { displayName })
      return mapFirebaseUser(user)
    },

    async signOut(): Promise<void> {
      await fbSignOut(getFirebaseAuth())
    },

    async getCurrentUser(): Promise<User | null> {
      const user = getFirebaseAuth().currentUser
      return user ? mapFirebaseUser(user) : null
    },

    async getIdToken(): Promise<string | null> {
      const user = getFirebaseAuth().currentUser
      return user ? user.getIdToken() : null
    },

    onAuthStateChanged(callback: (user: User | null) => void): () => void {
      return fbOnAuthStateChanged(getFirebaseAuth(), (u) => {
        callback(u ? mapFirebaseUser(u) : null)
      })
    },

    async updateProfile(input: { displayName?: string; email?: string }): Promise<void> {
      const auth = getFirebaseAuth()
      const user = auth.currentUser
      if (!user) throw new Error("No authenticated user")
      if (input.displayName !== undefined) {
        await fbUpdateProfile(user, { displayName: input.displayName })
      }
      if (input.email !== undefined) {
        await updateEmail(user, input.email)
      }
    },
  }
}

async function authHeader(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error("Not signed in")
  return { Authorization: `Bearer ${await user.getIdToken()}` }
}

function createFirebaseDbAdapter(): DatabaseAdapter {
  return {
    ...createFirebaseFinance(getFirebaseDb),

    // Keys are created and revoked by the server (#342): the rules refuse a
    // client write to api_keys_index, so the routes write both documents in one batch.
    async createApiKey(): Promise<{ key: string; id: string }> {
      const res = await fetch("/api/keys", { method: "POST", headers: await authHeader() })
      if (!res.ok) throw new Error("Could not create the API key")
      return (await res.json()) as { key: string; id: string }
    },

    async deleteApiKey(_userId: string, keyId: string): Promise<void> {
      const res = await fetch(`/api/keys/${encodeURIComponent(keyId)}`, {
        method: "DELETE",
        headers: await authHeader(),
      })
      if (!res.ok) throw new Error("Could not revoke the API key")
    },

    async getApiKeys(userId: string): Promise<{ id: string; prefix: string; createdAt: Date }[]> {
      try {
        const snap = await getDocsFromServer(collection(getFirebaseDb(), `users/${userId}/api_keys`)).catch(plainOffline)
        return snap.docs.map((d) => {
          const data: DocumentData = { id: d.id, ...d.data() }
          return {
            id: data.id,
            prefix: data.prefix as string,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt as string),
          }
        })
      } catch (err) {
        if ((err as { code?: unknown } | null)?.code === "permission-denied") return []
        throw err
      }
    }
  }
}

const firebaseAi: AIAdapter = {
  async chat(_userId: string, _message: string): Promise<string> {
    return "AI features require additional configuration."
  },
  async categorize(_description: string) {
    return null
  },
}

export function createFirebaseAdapter(): BackendAdapter {
  return {
    auth: createFirebaseAuthAdapter(),
    db: createFirebaseDbAdapter(),
    ai: firebaseAi,
  }
}
