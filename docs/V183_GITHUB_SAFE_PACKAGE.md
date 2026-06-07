# V183 — GitHub ZIP Commit Safe Package

Built from V182.

## Why
The previous ZIP included source artwork files with non-ASCII filenames. The GitHub ZIP commit app can fail with:

`The string did not match the expected pattern.`

## What changed
- Removed `approved-artwork/` from the deploy ZIP.
- Kept all extracted runtime card assets in `public/cards/`.
- Removed non-ASCII file paths from the package.
- Replaced the extraction script with a safe note.
- Kept V182 gameplay/card-wrapper polish.

## Runtime assets kept
- 52 suit card PNGs
- 4 joker PNGs
- 1 card back PNG
- `public/cards/manifest.json`

## Validation
- TypeScript check passed.
- Production build passed.
