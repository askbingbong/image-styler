# Image Styler

Browser-based photo stylizer. Everything runs locally in your browser — nothing is uploaded.

Pipeline (each step can be toggled):

1. **Posterize** to 3–16 colors of your choice (color pickers, presets, random, or extract from the image)
2. **Generate noise** (amount, grain size, mono/color)
3. **Pixelate / compress** (pixel size + repeated JPEG compression)
4. **Dither** back to your palette (cross-hatch, Bayer 4×4/8×8, Floyd–Steinberg, Atkinson)

Upload (click, drag-and-drop or paste), tweak, then **Download PNG**. The image, settings and any
"saved looks" persist in the browser via IndexedDB.

## Run locally

```bash
cd site && python3 -m http.server 8000
```

## GitHub Pages

`.github/workflows/pages.yml` deploys `site/` on every push to `main`.
One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
