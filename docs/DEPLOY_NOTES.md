# Deploy Notes

Recommended Vercel settings are already included in `vercel.json`.

## Install Command
```bash
npm install --no-package-lock --no-audit --no-fund
```

## Build Command
```bash
npm run vercel-build
```

## Node Version
The app expects Node `24.x` through `package.json` engines.

## QA
The custom rules QA script can be run with:

```bash
npm run rules-qa
```
