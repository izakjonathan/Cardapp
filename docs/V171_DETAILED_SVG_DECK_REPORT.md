# V171 — Detailed Colored SVG Deck

## What changed
- Replaced the previous simple SVG card face renderer with a more detailed deck-style SVG system.
- Added proper corner indices on both ends of every card.
- Added full pip layouts for A through 10.
- Added richer face-card layouts for J, Q, and K.
- Redesigned the joker into a more decorative jester-style card.
- Kept standard playing-card colors:
  - spades/clubs = black
  - hearts/diamonds = red
- Added a deck export script.

## Added files
- `scripts/export-svg-deck.mjs`
- `public/svg-deck/` with exported individual SVG card assets
- `public/svg-deck/manifest.json`

## Deck export
Run:

```bash
npm run export-svg-deck
```

This exports:
- 52 standard cards
- 4 jokers
- 1 card back

## Validation
- `npm run export-svg-deck` passed
- `npx tsc --noEmit` passed
