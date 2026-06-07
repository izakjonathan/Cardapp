# V181 — Approved Artwork Extraction + Clean App Integration

Built from V179.

## What changed
- Replaced the old placeholder/problematic card faces in `public/cards/` with freshly extracted card assets from the approved artwork sheets.
- Cropped and standardized the 52 suit cards from the approved spade, heart, diamond, and club sheets.
- Added 4 joker assets from the approved joker artwork.
- Added the approved card back asset.
- Kept the gameplay UI integration from the card-asset build so the hand, melds, stock, and discard use the approved artwork.
- Restored the `/deck` preview route to show the actual extracted assets.

## Source artwork used
- `illustration_of_hearts_playing_cards.png`
- `diamonds-sheet.png`
- `clubs-sheet.png`
- `spades-sheet.png`
- `joker_playing_card_design.png`
- `ornate_vintage_playing_card_back.png`

## Technical notes
- Assets were contour-cropped from the approved sheets.
- All exported card images were standardized to 474 × 696 for consistent in-app sizing.
