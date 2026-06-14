# V189 — Redesign + Consolidated Gameplay Layout

Built from V188.

## What changed
- Redesigned the gameplay layout so controls are reachable.
- Made the gameplay area internally scrollable.
- Added a sticky bottom controls bar.
- Reduced top section height.
- Tightened pile/discard area.
- Tightened hand area and card sizing for better mobile fit.
- Reduced meld section height and made it internally scrollable.
- Compact opponent counts.
- Consolidated the latest UI adjustments into a single V189 override block in `app/globals-base.css`.

## Main gameplay priority
1. Pile / discard
2. Your hand
3. Melds
4. Controls always reachable at the bottom

## Validation
- npm install --no-package-lock --no-audit --no-fund
- npx tsc --noEmit
- NEXT_PRIVATE_BUILD_WORKER=1 npm run build
