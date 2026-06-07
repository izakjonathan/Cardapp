"""
V183 commit-safe package note:

The approved card assets are already extracted into public/cards.

The original source artwork sheets were removed from this deploy ZIP because some
filenames contained non-ASCII characters, which can break the GitHub ZIP commit app.

To regenerate assets, use the full working source package that contains the
approved-artwork directory, or place source sheets back using ASCII filenames:
- hearts-sheet.png
- diamonds-sheet.png
- clubs-sheet.png
- spades-sheet.png
- joker.png
- card-back.png
"""
print("Card assets are already extracted in public/cards.")
