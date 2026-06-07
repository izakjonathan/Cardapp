# V173 — Large Individual SVG Deck

## What changed
- Rebuilt the exported SVG deck again as large individual SVG assets.
- All cards now export at **300 × 420**.
- Kept the full deck as separate files:
  - 52 standard cards
  - 4 jokers
  - 1 back
- Preserved the line-art / classic playing-card look with:
  - white card faces
  - red hearts / diamonds
  - black spades / clubs
  - decorative border treatment
  - mirrored court-card layouts
  - larger vector output for better visible detail

## Output folder
`public/svg-deck/`

## Included helper files
- `manifest.json`
- `deck-preview.svg`

## Export command
```bash
npm run export-svg-deck
```
