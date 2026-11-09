# Image Styler

Browser-based photo stylizer. Everything runs locally in your browser — nothing is uploaded.
Installable as an app (PWA) and works fully offline once loaded.

- **Simple mode:** pick from 41 looks (live previews of your photo), then tweak a few sliders and the palette.
- **Advanced mode:** stack modifiers in any order (reorder by dragging or arrows, toggle, duplicate, remove):
  Posterize, Gradient map, Noise, Pixelate, JPEG compress, Dither, Color adjust, Invert, Blur, Sharpen, Glow,
  RGB split, Glitch, Wave warp, Scanlines, Vignette, Halftone, Edges, Emboss, Mirror, Pixel sort, Lens warp, Tint, Border.
- Custom color picker, palette presets, 2–16 color palettes, palette extraction from the image.
- Only modifiers after the one you change are re-rendered.
- Undo/redo (Ctrl+Z / Ctrl+Y), rotate/flip, hold-to-compare with the original.
- Save as PNG/JPEG/WebP, or share straight from your phone.
- Image, stack, settings and saved looks persist in the browser (IndexedDB).

## Run locally

```bash
cd site && python3 -m http.server 8000
```

## GitHub Pages

`.github/workflows/pages.yml` deploys `site/` on every push to `main` (and stamps the service-worker cache
version with the commit SHA so installed copies update). One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

To install: open the site in Chrome/Edge/Android and tap **Install app**, or on iOS Safari use Share → Add to Home Screen.
