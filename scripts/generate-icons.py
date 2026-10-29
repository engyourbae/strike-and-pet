"""Membuat ikon PNG PWA dari desain logo (butuh: pip install pillow). Jalankan: npm run icons"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public"
(OUT / "assets").mkdir(parents=True, exist_ok=True)
SS = 4  # supersampling untuk tepi halus


def gradient(size):
    img = Image.new("RGB", (size, size))
    px = img.load()
    a, b = (0x5B, 0x3D, 0xF5), (0x8A, 0x5C, 0xFF)
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return img


def render(size, maskable=False):
    big = size * SS
    base = gradient(big).convert("RGBA")
    mask = Image.new("L", (big, big), 0)
    md = ImageDraw.Draw(mask)
    if maskable:
        md.rectangle([0, 0, big, big], fill=255)
    else:
        md.rounded_rectangle([0, 0, big, big], radius=int(big * 112 / 512), fill=255)
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    canvas.paste(base, (0, 0), mask)

    k = big / 512 * (0.78 if maskable else 1.0)
    off = (big - 512 * k) / 2

    def P(x, y):
        return (off + x * k, off + y * k)

    d = ImageDraw.Draw(canvas)
    for cx, cy, r in [(150, 205, 42), (215, 150, 44), (297, 150, 44), (362, 205, 42)]:
        d.ellipse([*P(cx - r, cy - r), *P(cx + r, cy + r)], fill="white")
    d.ellipse([*P(148, 238), *P(364, 422)], fill="white")
    d.polygon([P(278, 262), P(220, 338), P(254, 338), P(236, 402), P(304, 312), P(268, 312)], fill="#FF7A59")
    return canvas.resize((size, size), Image.LANCZOS)


render(192).save(OUT / "assets" / "icon-192.png")
render(512).save(OUT / "assets" / "icon-512.png")
render(512, maskable=True).save(OUT / "assets" / "icon-maskable-512.png")
render(180).save(OUT / "apple-touch-icon.png")
print("Ikon dibuat di", OUT)
