# V188 — Ultra Simple Centered Cards

Built from V187.

## Changes
- Simplified all card faces further.
- Each card now shows only:
  - one centered rank/letter
  - one centered suit symbol
- Rank/letter is placed above the suit symbol.
- Removed corner indices and extra card-face decoration.
- Kept suit colors clear:
  - spades/clubs = black
  - hearts/diamonds = red
- Joker is also simplified into a centered minimal face.

## Validation
- npm install --no-package-lock --no-audit --no-fund
- npx tsc --noEmit
- NEXT_PRIVATE_BUILD_WORKER=1 npm run build
