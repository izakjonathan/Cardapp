# Rummy 500 — V170 Release Candidate

Playable Rummy 500 web app with shared rooms, saved games, phone-seat mode, SVG cards, joker rules, automatic scoring, and rules QA.

## Install

```bash
npm install --no-package-lock --no-audit --no-fund
```

## Run locally

```bash
npm run dev
```

## QA

```bash
npm run rules-qa
npx tsc --noEmit
```

## Build

```bash
NEXT_PRIVATE_BUILD_WORKER=1 npm run build
```

## Vercel

The included `vercel.json` sets:

- install: `npm install --no-package-lock --no-audit --no-fund`
- build: `npm run vercel-build`
- Node engine: `24.x`

## Release notes

See `docs/V170_RELEASE_CANDIDATE_REPORT.md` and `docs/DEPLOY_NOTES.md`.
