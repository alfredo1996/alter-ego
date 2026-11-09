---
model: haiku
description: Run the production build and report errors
user_invocable: true
---

# /build-check — Build Verification

Build the app, as the gate does.

## Steps

1. Run:
   `NEXT_PUBLIC_BACKEND=mock pnpm build`
2. If every build succeeds, report success.
3. If one fails:
   - Parse the error output for file paths and error messages
   - Read the failing files
   - Suggest fixes or implement them
   - Re-run that mode to verify, then the other two

## Notes

- TypeScript errors surface during `next build`.
- Builds write `.next/`; run them one after the other, not in parallel.
