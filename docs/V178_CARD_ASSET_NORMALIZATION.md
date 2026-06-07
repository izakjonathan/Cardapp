# V178 — Long-Term Card Cutout Fix

This build keeps the approved full-card artwork but fixes the card cutout problem by normalizing the asset pipeline.

## What changed
- Every card PNG in `public/cards` was auto-cropped to the actual card bounds.
- Every card was then re-centered onto the same 450×630 master canvas with uniform padding.
- The playable card CSS now clips and displays the assets cleanly in the hand, melds, stock, and discard areas.
- Added `scripts/normalize-card-assets.py` so the deck can be re-normalized in future builds.

## Why this is the long-term fix
Instead of relying on inconsistent raw image exports, the app now uses a repeatable normalization step that keeps all cards aligned and evenly cut out.
