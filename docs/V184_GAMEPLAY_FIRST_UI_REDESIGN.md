# V184 — Gameplay-first UI redesign

Built from V183.

## Changes
- redesigned the active game layout around the main elements:
  - pile / discard
  - own hand
  - melds
- increased card display size in the hand
- wrapped rendered card assets in a rounded rectangular shell that matches the card art better
- improved pile card presentation with dedicated card shells for stock/discard
- enlarged and clarified the meld area
- kept opponent card counts compact at the bottom
- hid the rounds card while in active card-table mode to reduce clutter
- hid the old compact scoreboard while in active card-table mode

## Validation
- npm install --no-package-lock --no-audit --no-fund
- npx tsc --noEmit
- npm run build
