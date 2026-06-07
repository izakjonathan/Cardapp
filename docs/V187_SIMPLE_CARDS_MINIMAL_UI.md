# V187 — Simple Cards + Minimal UI

Built from V186.

## Changes
- Replaced artwork-heavy cards with simple SVG cards.
- No illustrations; cards now use clear rank, suit symbols, and suit color only.
- Simplified J/Q/K to minimal letter + suit treatment.
- Added a simple back-of-card SVG for the stock.
- Removed the border around the whole gameplay area.
- Reduced excess borders and shadows across gameplay UI.
- Moved gameplay controls to the bottom.
- Kept hand and melds in the upper gameplay area.
- Made controls smaller.
- Reduced vertical clutter and simplified section styling.

## Validation
- npm install --no-package-lock --no-audit --no-fund
- npx tsc --noEmit
- NEXT_PRIVATE_BUILD_WORKER=1 npm run build
