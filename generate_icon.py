#!/usr/bin/env python3
"""Generate a 1024x1024 AnyTorah app icon with a stack of books on dark blue."""

from PIL import Image, ImageDraw
import os

SIZE = 1024
BG_COLOR = (27, 58, 138)  # #1B3A8A dark blue

# Book colors: gold/amber, red, light blue
BOOK_COLORS = [
    (212, 175, 55),   # gold/amber  (top)
    (180, 50, 50),    # red         (middle)
    (100, 160, 220),  # light blue  (bottom)
]

img = Image.new("RGB", (SIZE, SIZE), BG_COLOR)
draw = ImageDraw.Draw(img)

# Stack layout — fill most of the icon vertically
book_w   = 820   # wide books
book_h   = 145   # book thickness
spine_w  = 65    # visible spine on left
gap      = 225   # center-to-center distance (gives ~80px gap between books)

# Center the stack: 3 books span 145 + 2*225 = 595px.
# Perfect vertical centering: top edge at (1024-595)/2 = 214, bottom at 214+595=809.
# Top book center: 214 + 72 = 286; bottom book center: 286 + 2*225 = 736.
book_y_start = 736

for i, color in enumerate(reversed(BOOK_COLORS)):
    y  = book_y_start - i * gap
    x0 = (SIZE - book_w) // 2
    y0 = y - book_h // 2
    x1 = x0 + book_w
    y1 = y + book_h // 2

    # Main book body
    draw.rectangle([x0, y0, x1, y1], fill=color)

    # Spine (left side, slightly darker)
    spine_color = tuple(max(0, c - 50) for c in color)
    draw.rectangle([x0, y0, x0 + spine_w, y1], fill=spine_color)

    # Page edges (right side, slightly lighter)
    page_color = tuple(min(255, c + 40) for c in color)
    draw.rectangle([x1 - 10, y0 + 6, x1, y1 - 6], fill=page_color)

    # Subtle white border
    draw.rectangle([x0, y0, x1, y1], outline=(255, 255, 255, 80), width=2)

# Save
out_path = os.path.join(
    os.path.dirname(__file__),
    "AnyTorah", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-1024.png"
)
img.save(out_path, "PNG")
print(f"Saved icon to: {out_path}")
