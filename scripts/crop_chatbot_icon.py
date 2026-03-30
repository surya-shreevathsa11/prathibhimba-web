from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    src = root / "public" / "img" / "chatbot(icon).png"
    dst = root / "public" / "img" / "chatbot-icon-cropped.png"

    img = Image.open(src).convert("RGBA")
    arr = np.array(img)
    r, g, b, a = [arr[..., i] for i in range(4)]

    # Consider near-white pixels as background.
    nonwhite = (a > 0) & ~((r > 245) & (g > 245) & (b > 245))
    ys, xs = np.where(nonwhite)

    if xs.size and ys.size:
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        pad = int(max(img.size) * 0.03)
        x0 = max(0, x0 - pad)
        y0 = max(0, y0 - pad)
        x1 = min(img.size[0] - 1, x1 + pad)
        y1 = min(img.size[1] - 1, y1 + pad)
        cropped = img.crop((x0, y0, x1 + 1, y1 + 1))
    else:
        cropped = img

    # Make square canvas (transparent), then mask to a circle.
    w, h = cropped.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - w) // 2, (side - h) // 2), cropped)

    mask = Image.new("L", (side, side), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, side - 1, side - 1), fill=255)

    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), mask)

    # Export at button size for crisp rendering.
    out = out.resize((52, 52), Image.Resampling.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, optimize=True)
    print(f"Wrote {dst}")


if __name__ == "__main__":
    main()

