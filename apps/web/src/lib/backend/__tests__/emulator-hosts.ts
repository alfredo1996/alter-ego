/**
 * The one place the emulator suite learns where its emulators are. Test-only.
 *
 * Reads FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST (the variables
 * the Firebase tools already use), defaulting to the standard ports. Every
 * seed, wipe and connection in the suite goes through here, so pointing the
 * suite at another emulator is one env change and no file edit.
 */

export const TEST_PROJECT_ID = "demo-alter-ego";

export interface EmulatorHosts {
  /** host:port, as the Admin SDK reads it */
  firestore: string;
  auth: string;
  firestorePort: number;
  authPort: number;
}

export function emulatorHosts(
  env: Record<string, string | undefined> = process.env,
): EmulatorHosts {
  const firestore = env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  const auth = env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
  const port = (hostPort: string) => Number(hostPort.split(":").pop());
  return {
    firestore,
    auth,
    firestorePort: port(firestore),
    authPort: port(auth),
  };
}

export function firestoreRestBase(firestoreHost: string): string {
  return `http://${firestoreHost}/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`;
}

/**
 * Throws unless both emulators are throwaway: hosts set together, no Firestore
 * collection, no Auth account. The wipe is project-scoped and the owner's
 * long-lived emulator uses the same project id, so the id cannot tell them
 * apart: its data can. A crashed run leaves data behind; recreate the
 * container (`docker rm -f`) rather than loosen this. Run before any delete.
 */
export async function assertThrowawayEmulator(
  env: Record<string, string | undefined> = process.env,
  doFetch: typeof fetch = fetch,
): Promise<void> {
  // Half a redirect would inspect one emulator and wipe the other.
  if (!env.FIRESTORE_EMULATOR_HOST !== !env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error(
      "Set FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST together, or neither.",
    );
  const { firestore, auth } = emulatorHosts(env);
  const post = async (url: string) => {
    const res = await doFetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) throw new Error(`Cannot inspect the emulator at ${url}: ${res.status}`);
    return (await res.json()) as {
      collectionIds?: string[];
      userInfo?: unknown[];
    };
  };
  const { collectionIds = [] } = await post(
    `${firestoreRestBase(firestore)}:listCollectionIds`,
  );
  const { userInfo = [] } = await post(
    `http://${auth}/identitytoolkit.googleapis.com/v1/projects/${TEST_PROJECT_ID}/accounts:query`,
  );
  if (collectionIds.length > 0 || userInfo.length > 0) {
    throw new Error(
      `Refusing to wipe the emulators at ${firestore} and ${auth}: they hold data ` +
        `(${collectionIds.join(", ") || "no collections"}; ${userInfo.length} Auth accounts), so they are not throwaway test emulators. Point ` +
        `FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST ` +
        `at your own fresh container.`,
    );
  }
}
