# V177 — Full-Card Asset Deck Integration

Built from the uploaded playable V174 ZIP.

## What changed
- Added full-card image assets in `public/cards/`.
- Added `/deck` preview route.
- Replaced the playable hand and meld card rendering with image assets.
- Added stock card-back preview and discard top-card preview.
- Kept the existing card game logic unchanged.

## Included assets
- `AS.png` through `KS.png`
- `AH.png` through `KH.png`
- `AD.png` through `KD.png`
- `AC.png` through `KC.png`
- `JOKER1.png` through `JOKER4.png`
- `BACK.png`
- `manifest.json`

## Notes
The app now uses full-card images for the actual playing-card UI. The older SVG renderer remains in the code as a fallback/reference but is no longer used in the hand/meld render path.
