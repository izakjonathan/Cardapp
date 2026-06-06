# V170 — Release Candidate Cleanup

## Purpose
This build is intended as the stable release-candidate baseline after the playable Rummy 500 rule hardening pass.

## Cleanup
- Removed old version report clutter from the project root.
- Kept the active rules QA report in `docs/`.
- Removed transient TypeScript build metadata from the release ZIP.
- Kept the source structure flat and Vercel-friendly.

## Deploy settings
- Node engine remains `24.x`.
- Vercel install command remains `npm install --no-package-lock --no-audit --no-fund`.
- Vercel build command remains `npm run vercel-build`.
- No package lock file is included.

## Validation commands
Run these before or after deploy if needed:

```bash
npm install --no-package-lock --no-audit --no-fund
npm run rules-qa
npx tsc --noEmit
NEXT_PRIVATE_BUILD_WORKER=1 npm run build
```

## Release-candidate scope
No new gameplay features were added in this build. The goal was to preserve V169 behavior while making the project cleaner and easier to deploy/maintain.
