# Deploy Your Own

Alter Ego is a Next.js app that runs on a Firebase project (Firestore and Authentication).
Any host that runs Next.js works; these are the steps for **Firebase App Hosting**, with
`NEXT_PUBLIC_BACKEND=firebase`.

## Before you start

- A Firebase project with **Firestore** and **Authentication** (Email/Password) enabled.
- The Firebase CLI: `npm i -g firebase-tools && firebase login`.
- Your own project id. Everything in the repository that says `demo-alter-ego` is a
  placeholder for it (`.firebaserc`, `apps/web/apphosting.yaml`).

## Steps

```bash
# 1. Create the App Hosting backend (links your GitHub repository to Cloud Run).
#    Set its root directory to apps/web: App Hosting reads apphosting.yaml from there.
firebase apphosting:backends:create --project YOUR_PROJECT_ID

# 2. Store the sensitive variables as secrets
firebase apphosting:secrets:set FIREBASE_API_KEY --project YOUR_PROJECT_ID
firebase apphosting:secrets:set FIREBASE_MESSAGING_SENDER_ID --project YOUR_PROJECT_ID
firebase apphosting:secrets:set FIREBASE_APP_ID --project YOUR_PROJECT_ID

# 3. Put your project id, auth domain and public origin in apps/web/apphosting.yaml

# 4. Deploy the security rules and indexes
pnpm rules:build
firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID

# 5. Seed the default categories (idempotent)
FIREBASE_PROJECT_ID=YOUR_PROJECT_ID pnpm seed:firebase
```

## Who can sign in

Sign-up is closed: the rules admit one user id, `isAllowedUser` in
`firestore/base.rules`, mirrored in `apps/web/src/lib/owner-uid.ts`. Create your user in the
Firebase console (Authentication), then put its uid in both places and run `pnpm rules:build`.

## Notes

- **MCP server:** set `MCP_PUBLIC_ORIGIN` in `apphosting.yaml` to the canonical public
  origin. It is also the OAuth issuer, so it must match the URL the connector uses.
- **Custom domain:** `firebase apphosting:domains` or the console.
- **Local and self-hosted:** see [SELF-HOSTING.md](SELF-HOSTING.md) and
  [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md).
