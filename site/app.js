(() => {
'use strict';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hsvToRgb(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx ? d / mx : 0, mx];
}
const hsvHex = (h, s, v) => rgbToHex(...hsvToRgb(h, s, v));
const hslHex = (h, s, l) => { const v = l + s * Math.min(l, 1 - l); return hsvHex(h, v ? 2 * (1 - l / v) : 0, v); };
const ramp = (h, n = 6, s = .8) => Array.from({ length: n }, (_, i) => hslHex(h, s * (.55 + .45 * Math.sin(Math.PI * (i / (n - 1)))), .05 + .9 * i / (n - 1)));
const uid = () => Math.random().toString(36).slice(2, 8);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

/* ================= palettes ================= */
const PRESETS = {
  'Sunset': ['#1b1035', '#5b2a86', '#c13584', '#ff5e6c', '#ff9a5a', '#ffe7a3'],
  'Red': ramp(355, 6, .9),
  'Crimson Night': ['#000000', '#2a0a18', '#5a1a3a', '#8a2a4e', '#d02a2a', '#ff4030'],
  'Blood Moon': ['#0a0003', '#3b0012', '#7a0a1c', '#c4161c', '#ff4d3a', '#ffd9c9'],
  'Orange': ramp(25, 6, .95),
  'Gold': ['#1a1203', '#4a3408', '#8f6a14', '#d4a62a', '#f7d96b', '#fff6d6'],
  'Matrix': ['#000000', '#00260b', '#006b22', '#00c53a', '#7dff9a', '#eafff0'],
  'Teal': ramp(175, 6, .85),
  'Ice Blue': ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8', '#ffffff'],
  'Deep Blue': ramp(225, 6, .9),
  'Purple': ramp(275, 6, .85),
  'Hot Pink': ramp(330, 6, .95),
  'Neon': ['#0b0021', '#2d00f7', '#8900f2', '#f20089', '#00f5d4', '#fff75e'],
  'Vaporwave': ['#1a0933', '#ff71ce', '#b967ff', '#01cdfe', '#05ffa1', '#fffb96'],
  'Pastel': ['#2b2d42', '#8d99ae', '#cdb4db', '#ffafcc', '#bde0fe', '#fdf6e3'],
  'Game Boy': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  'Virtual Boy': ['#000000', '#550000', '#aa0000', '#ff0000'],
  'CGA': ['#000000', '#55ffff', '#ff55ff', '#ffffff'],
  'Noir': ['#000000', '#3a3a3a', '#8a8a8a', '#d9d9d9', '#ffffff'],
  'Sepia': ['#1b1008', '#4a2f1a', '#85603a', '#c19a6b', '#ecd9b5', '#fff8e7'],
  'Forest': ['#0b1d16', '#1f4d3a', '#3f7d4e', '#9bc268', '#f1e9b8'],
  'Rainbow 16': Array.from({ length: 16 }, (_, i) => hslHex(i * 22.5, .85, .55)),
};
const presetName = pal => Object.keys(PRESETS).find(k => PRESETS[k].join() === pal.join());

/* ================= effect library ================= */
const R = (k, label, min, max, step, def) => ({ t: 'range', k, label, min, max, step, def });
const S = (k, label, opts, def) => ({ t: 'select', k, label, opts, def });
const C = (k, label, def) => ({ t: 'check', k, label, def });
const COL = (k, label, def) => ({ t: 'color', k, label, def });
const PAL = { t: 'palette', k: 'palette' };
const SEED = { t: 'seed', k: 'seed', def: 1 };

function px(cv, fn) {
  const g = cv.getContext('2d', { willReadFrequently: true }), id = g.getImageData(0, 0, cv.width, cv.height);
  fn(id); g.putImageData(id, 0, 0);
}
function copyOf(cv) { const c = mk(cv.width, cv.height); c.getContext('2d').drawImage(cv, 0, 0); return c; }
function down(cv, s) {
  const t = mk(Math.ceil(cv.width / s), Math.ceil(cv.height / s)), g = t.getContext('2d');
  g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, t.width, t.height); return t;
}
function up(t, cv, s) {
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(t, 0, 0, t.width, t.height, 0, 0, t.width * s, t.height * s);
}
function nearest(pal, r, g, b) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < pal.length; i++) {
    const p = pal[i], dr = r - p[0], dg = g - p[1], db = b - p[2], d = dr * dr + dg * dg + db * db;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
const palRgb = p => p.palette.map(hexToRgb);

function boxBlurF(buf, w, hh, r) { // buf: Float32Array RGB interleaved
  r = Math.max(1, Math.round(r));
  let a = buf, b = new Float32Array(buf.length);
  const n = 2 * r + 1;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < hh; y++) for (let c = 0; c < 3; c++) {
      let sum = 0; const base = y * w;
      for (let i = -r; i <= r; i++) sum += a[(base + clamp(i, 0, w - 1)) * 3 + c];
      for (let x = 0; x < w; x++) {
        b[(base + x) * 3 + c] = sum / n;
        sum += a[(base + Math.min(x + r + 1, w - 1)) * 3 + c] - a[(base + Math.max(x - r, 0)) * 3 + c];
      }
    }
    for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += b[(clamp(i, 0, hh - 1) * w + x) * 3 + c];
      for (let y = 0; y < hh; y++) {
        a[(y * w + x) * 3 + c] = sum / n;
        sum += b[(Math.min(y + r + 1, hh - 1) * w + x) * 3 + c] - b[(Math.max(y - r, 0) * w + x) * 3 + c];
      }
    }
  }
  return a;
}
const toF = d => { const f = new Float32Array(d.length / 4 * 3); for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { f[j] = d[i]; f[j + 1] = d[i + 1]; f[j + 2] = d[i + 2]; } return f; };

// dither threshold matrices
function bayer(n) {
  let m = [[0]];
  while (m.length < n) {
    const k = m.length, r = Array.from({ length: k * 2 }, () => new Array(k * 2));
    for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) {
      const v = m[y][x] * 4; r[y][x] = v; r[y][x + k] = v + 2; r[y + k][x] = v + 3; r[y + k][x + k] = v + 1;
    }
    m = r;
  }
  return { n, v: m.flat().map(v => (v + .5) / (n * n)) };
}
const B4 = bayer(4), B8 = bayer(8);
const CROSS = (() => {
  const n = 8, v = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = (x + y) % n, b = (x - y + n) % n;
    v.push((Math.min(Math.min(a, n - a), Math.min(b, n - b)) + B8.v[y * n + x]) / 3);
  }
  return { n, v };
})();
function ditherData(id, pal, o) {
  const { width: w, height: hh, data } = id, str = o.strength / 100;
  if (o.method === 'floyd' || o.method === 'atkinson') {
    const buf = toF(data), fs = o.method === 'floyd';
    const taps = fs ? [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]]
      : [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]];
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 3, r = clamp(buf[j], 0, 255), g = clamp(buf[j + 1], 0, 255), b = clamp(buf[j + 2], 0, 255);
      const p = pal[nearest(pal, r, g, b)], er = (r - p[0]) * str, eg = (g - p[1]) * str, eb = (b - p[2]) * str;
      const i = (y * w + x) * 4; data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2];
      for (const [dx, dy, wt] of taps) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= w || ny >= hh) continue;
        const k = (ny * w + nx) * 3; buf[k] += er * wt; buf[k + 1] += eg * wt; buf[k + 2] += eb * wt;
      }
    }
    return;
  }
  const m = o.method === 'bayer4' ? B4 : o.method === 'bayer8' ? B8 : CROSS, spread = str * 200;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, t = (m.v[(y % m.n) * m.n + (x % m.n)] - .5) * spread;
    const p = pal[nearest(pal, data[i] + t, data[i + 1] + t, data[i + 2] + t)];
    data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2];
  }
}
async function jpegPass(c, q) {
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); if (!blob) return;
  const bmp = await createImageBitmap(blob); c.getContext('2d').drawImage(bmp, 0, 0); bmp.close && bmp.close();
}
function wrapDraw(g, cp, sx, sy, sw, sh, dx, dy, vertical) { // draw strip shifted with wrap-around
  const W = vertical ? cp.height : cp.width, d = Math.round(dx);
  const at = o => vertical ? g.drawImage(cp, sx, sy, sw, sh, dy, o, sw, sh) : g.drawImage(cp, sx, sy, sw, sh, o, dy, sw, sh);
  at(d); if (d > 0) at(d - W); else if (d < 0) at(d + W);
}

const TYPES = {
  posterize: { name: 'Posterize', desc: 'Reduce to 3–16 colors you choose', hue: 330, params: [PAL],
    run(cv, p) { const pal = palRgb(p); px(cv, id => { const d = id.data; for (let i = 0; i < d.length; i += 4) { const c = pal[nearest(pal, d[i], d[i + 1], d[i + 2])]; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; } }); } },
  noise: { name: 'Noise', desc: 'Film grain / static', hue: 200, params: [R('amount', 'Amount', 0, 100, 1, 30), R('size', 'Grain size', 1, 8, 1, 1), C('mono', 'Monochrome', true), SEED],
    run(cv, p) { px(cv, id => {
      const { width: w, height: hh, data } = id, rnd = mulberry32(p.seed), amp = p.amount / 100 * 255, s = p.size;
      const gw = Math.ceil(w / s), gh = Math.ceil(hh / s), ch = p.mono ? 1 : 3, grid = new Float32Array(gw * gh * ch);
      for (let i = 0; i < grid.length; i++) grid[i] = (rnd() - .5) * 2 * amp;
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const gi = ((y / s | 0) * gw + (x / s | 0)) * ch, i = (y * w + x) * 4;
        data[i] += grid[gi]; data[i + 1] += grid[ch === 1 ? gi : gi + 1]; data[i + 2] += grid[ch === 1 ? gi : gi + 2];
      } }); } },
  pixelate: { name: 'Pixelate', desc: 'Chunky blocks', hue: 150, params: [R('size', 'Pixel size', 2, 48, 1, 4)],
    run(cv, p) { const t = down(cv, p.size); up(t, cv, p.size); } },
  compress: { name: 'JPEG compress', desc: 'Crunchy compression artifacts', hue: 35, params: [R('quality', 'Quality', 1, 100, 1, 30), R('passes', 'Passes', 1, 8, 1, 2), R('scale', 'Artifact size', 1, 16, 1, 4)],
    async run(cv, p) { const s = p.scale, t = s > 1 ? down(cv, s) : cv; for (let i = 0; i < p.passes; i++) await jpegPass(t, p.quality / 100); if (s > 1) up(t, cv, s); } },
  dither: { name: 'Dither', desc: 'Map to palette with patterns', hue: 270, params: [S('method', 'Style', [['cross', 'Cross-hatch'], ['bayer4', 'Bayer 4×4'], ['bayer8', 'Bayer 8×8'], ['floyd', 'Floyd–Steinberg'], ['atkinson', 'Atkinson']], 'cross'), R('strength', 'Strength', 0, 100, 1, 70), R('scale', 'Dither scale', 1, 8, 1, 2), PAL],
    run(cv, p) { const pal = palRgb(p), s = p.scale, t = s > 1 ? down(cv, s) : cv; px(t, id => ditherData(id, pal, p)); if (s > 1) up(t, cv, s); } },
  gradient: { name: 'Gradient map', desc: 'Map brightness onto a color ramp (with dither)', hue: 345, params: [S('method', 'Dither', [['none', 'None (hard bands)'], ['bayer4', 'Bayer 4×4'], ['bayer8', 'Bayer 8×8'], ['cross', 'Cross-hatch']], 'bayer4'), R('strength', 'Dither strength', 0, 100, 1, 70), R('scale', 'Dither scale', 1, 8, 1, 2), C('sort', 'Sort colors dark → light', true), PAL],
    run(cv, p) {
      const lum = c => .299 * c[0] + .587 * c[1] + .114 * c[2], pal = palRgb(p); if (p.sort) pal.sort((a, b) => lum(a) - lum(b));
      const n = pal.length, s = p.scale, t = s > 1 ? down(cv, s) : cv, str = p.strength / 100;
      const m = p.method === 'bayer4' ? B4 : p.method === 'bayer8' ? B8 : p.method === 'cross' ? CROSS : null;
      px(t, id => { const { width: w, height: hh, data: d } = id;
        for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4; let pos = lum(d.subarray(i, i + 3)) / 255 * (n - 1);
          if (m) pos += (m.v[(y % m.n) * m.n + (x % m.n)] - .5) * str;
          const c = pal[clamp(Math.round(pos), 0, n - 1)]; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        } });
      if (s > 1) up(t, cv, s); } },
  adjust: { name: 'Color adjust', desc: 'Brightness, contrast, saturation, hue', hue: 55, params: [R('brightness', 'Brightness', -100, 100, 1, 0), R('contrast', 'Contrast', -100, 100, 1, 0), R('saturation', 'Saturation', -100, 100, 1, 0), R('hue', 'Hue shift', 0, 360, 1, 0)],
    run(cv, p) {
      const a = p.hue * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
      const m = [.213 + cs * .787 - sn * .213, .715 - cs * .715 - sn * .715, .072 - cs * .072 + sn * .928,
        .213 - cs * .213 + sn * .143, .715 + cs * .285 + sn * .140, .072 - cs * .072 - sn * .283,
        .213 - cs * .213 - sn * .787, .715 - cs * .715 + sn * .715, .072 + cs * .928 + sn * .072];
      const c = p.contrast * 2.55, cf = 259 * (c + 255) / (255 * (259 - c)), sat = 1 + p.saturation / 100, br = p.brightness * 2.55;
      px(cv, id => { const d = id.data; for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let R2 = m[0] * r + m[1] * g + m[2] * b, G2 = m[3] * r + m[4] * g + m[5] * b, B2 = m[6] * r + m[7] * g + m[8] * b;
        const l = .299 * R2 + .587 * G2 + .114 * B2;
        R2 = l + (R2 - l) * sat; G2 = l + (G2 - l) * sat; B2 = l + (B2 - l) * sat;
        d[i] = (R2 - 128) * cf + 128 + br; d[i + 1] = (G2 - 128) * cf + 128 + br; d[i + 2] = (B2 - 128) * cf + 128 + br;
      } }); } },
  invert: { name: 'Invert', desc: 'Flip the colors', hue: 0, params: [R('amount', 'Amount', 0, 100, 1, 100)],
    run(cv, p) { const t = p.amount / 100; px(cv, id => { const d = id.data; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] += (255 - 2 * d[i + k]) * t; }); } },
  blur: { name: 'Blur', desc: 'Soften the image', hue: 210, params: [R('radius', 'Radius', 1, 40, 1, 4)],
    run(cv, p) { px(cv, id => { const f = boxBlurF(toF(id.data), id.width, id.height, p.radius), d = id.data; for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { d[i] = f[j]; d[i + 1] = f[j + 1]; d[i + 2] = f[j + 2]; } }); } },
  glow: { name: 'Glow', desc: 'Bloom on bright areas', hue: 45, params: [R('threshold', 'Threshold', 0, 255, 1, 150), R('radius', 'Radius', 1, 50, 1, 12), R('strength', 'Strength', 0, 200, 1, 80)],
    run(cv, p) { px(cv, id => {
      const d = id.data, f = toF(d), k = p.strength / 100;
      for (let j = 0; j < f.length; j += 3) { const l = .299 * f[j] + .587 * f[j + 1] + .114 * f[j + 2]; if (l < p.threshold) f[j] = f[j + 1] = f[j + 2] = 0; }
      boxBlurF(f, id.width, id.height, p.radius);
      for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { d[i] += f[j] * k; d[i + 1] += f[j + 1] * k; d[i + 2] += f[j + 2] * k; }
    }); } },
  rgbshift: { name: 'RGB split', desc: 'Chromatic aberration', hue: 350, params: [R('amount', 'Distance', 0, 60, 1, 8), R('angle', 'Angle', 0, 360, 1, 0)],
    run(cv, p) { px(cv, id => {
      const { width: w, height: hh, data } = id, o = new Uint8ClampedArray(data), a = p.angle * Math.PI / 180;
      const dx = Math.round(Math.cos(a) * p.amount), dy = Math.round(Math.sin(a) * p.amount);
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = o[(clamp(y + dy, 0, hh - 1) * w + clamp(x + dx, 0, w - 1)) * 4];
        data[i + 2] = o[(clamp(y - dy, 0, hh - 1) * w + clamp(x - dx, 0, w - 1)) * 4 + 2];
      } }); } },
  glitch: { name: 'Glitch', desc: 'Torn horizontal slices', hue: 300, params: [R('slices', 'Slices', 1, 60, 1, 14), R('intensity', 'Intensity', 0, 100, 1, 40), SEED],
    run(cv, p) { const cp = copyOf(cv), g = cv.getContext('2d'), rnd = mulberry32(p.seed), W = cv.width, H = cv.height;
      for (let i = 0; i < p.slices; i++) { const y = rnd() * H | 0, sh = Math.max(1, (rnd() * H * .08 | 0) + 1), dx = (rnd() - .5) * 2 * p.intensity / 100 * W * .3;
        wrapDraw(g, cp, 0, y, W, sh, dx, y, false); } } },
  wave: { name: 'Wave warp', desc: 'Wobbly sine distortion', hue: 185, params: [R('amplitude', 'Amplitude', 0, 80, 1, 12), R('length', 'Wavelength', 10, 400, 1, 120), S('dir', 'Direction', [['h', 'Horizontal'], ['v', 'Vertical']], 'h')],
    run(cv, p) { const cp = copyOf(cv), g = cv.getContext('2d'), W = cv.width, H = cv.height;
      if (p.dir === 'h') for (let y = 0; y < H; y++) wrapDraw(g, cp, 0, y, W, 1, Math.sin(y / p.length * 6.2832) * p.amplitude, y, false);
      else for (let x = 0; x < W; x++) wrapDraw(g, cp, x, 0, 1, H, Math.sin(x / p.length * 6.2832) * p.amplitude, x, true); } },
  scanlines: { name: 'Scanlines', desc: 'CRT-style lines', hue: 120, params: [R('spacing', 'Spacing', 2, 16, 1, 4), R('darkness', 'Darkness', 0, 100, 1, 45)],
    run(cv, p) { const g = cv.getContext('2d'); g.fillStyle = `rgba(0,0,0,${p.darkness / 100})`; const t = Math.ceil(p.spacing / 2); for (let y = 0; y < cv.height; y += p.spacing) g.fillRect(0, y, cv.width, t); } },
  vignette: { name: 'Vignette', desc: 'Darken the edges', hue: 250, params: [R('strength', 'Strength', 0, 100, 1, 70), R('size', 'Clear area', 0, 100, 1, 35)],
    run(cv, p) { const g = cv.getContext('2d'), W = cv.width, H = cv.height, rr = Math.hypot(W, H) / 2;
      const gr = g.createRadialGradient(W / 2, H / 2, rr * p.size / 100 * .9, W / 2, H / 2, rr);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${p.strength / 100})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); } },
  halftone: { name: 'Halftone', desc: 'Newspaper dots', hue: 10, params: [R('cell', 'Dot grid', 4, 32, 1, 10), C('color', 'Color dots', true), C('invert', 'Dark dots on paper', false)],
    run(cv, p) {
      const s = p.cell, t = down(cv, s), id = t.getContext('2d').getImageData(0, 0, t.width, t.height).data, g = cv.getContext('2d');
      g.fillStyle = p.invert ? '#f4f1ea' : '#050505'; g.fillRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < t.height; y++) for (let x = 0; x < t.width; x++) {
        const i = (y * t.width + x) * 4, r = id[i], gg = id[i + 1], b = id[i + 2], l = (.299 * r + .587 * gg + .114 * b) / 255;
        const rad = Math.sqrt(p.invert ? 1 - l : l) * s * .72; if (rad < .3) continue;
        g.fillStyle = p.color ? `rgb(${r},${gg},${b})` : p.invert ? '#111' : '#fff';
        g.beginPath(); g.arc((x + .5) * s, (y + .5) * s, rad, 0, 6.2832); g.fill();
      } } },
  edges: { name: 'Edges', desc: 'Outline detection', hue: 90, params: [S('mode', 'Mode', [['overlay', 'Lines on image'], ['only', 'Edges only']], 'overlay'), R('strength', 'Strength', 0, 100, 1, 80)],
    run(cv, p) { px(cv, id => {
      const { width: w, height: hh, data: d } = id, L = new Float32Array(w * hh), k = p.strength / 100;
      for (let i = 0; i < L.length; i++) L[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const G = (xx, yy) => L[clamp(yy, 0, hh - 1) * w + clamp(xx, 0, w - 1)];
        const gx = -G(x - 1, y - 1) - 2 * G(x - 1, y) - G(x - 1, y + 1) + G(x + 1, y - 1) + 2 * G(x + 1, y) + G(x + 1, y + 1);
        const gy = -G(x - 1, y - 1) - 2 * G(x, y - 1) - G(x + 1, y - 1) + G(x - 1, y + 1) + 2 * G(x, y + 1) + G(x + 1, y + 1);
        const e = Math.min(1, Math.hypot(gx, gy) / 200) * k, i = (y * w + x) * 4;
        if (p.mode === 'only') d[i] = d[i + 1] = d[i + 2] = e * 255; else { d[i] *= 1 - e; d[i + 1] *= 1 - e; d[i + 2] *= 1 - e; }
      } }); } },
  sharpen: { name: 'Sharpen', desc: 'Crisp up fine detail', hue: 160, params: [R('amount', 'Amount', 0, 300, 1, 100), R('radius', 'Radius', 1, 10, 1, 2)],
    run(cv, p) { px(cv, id => { const d = id.data, f = toF(d), b = boxBlurF(toF(d), id.width, id.height, p.radius), k = p.amount / 100;
      for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { d[i] = f[j] + (f[j] - b[j]) * k; d[i + 1] = f[j + 1] + (f[j + 1] - b[j + 1]) * k; d[i + 2] = f[j + 2] + (f[j + 2] - b[j + 2]) * k; } }); } },
  emboss: { name: 'Emboss', desc: 'Raised relief lighting', hue: 25, params: [R('strength', 'Strength', 0, 300, 1, 100), R('angle', 'Light angle', 0, 360, 1, 135), S('mode', 'Mode', [['gray', 'Gray relief'], ['color', 'Keep color']], 'gray')],
    run(cv, p) { px(cv, id => {
      const { width: w, height: hh, data: d } = id, L = new Float32Array(w * hh), a = p.angle * Math.PI / 180, dx = Math.round(Math.cos(a) * 1.4), dy = Math.round(Math.sin(a) * 1.4), k = p.strength / 100;
      for (let i = 0; i < L.length; i++) L[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const df = (L[clamp(y + dy, 0, hh - 1) * w + clamp(x + dx, 0, w - 1)] - L[clamp(y - dy, 0, hh - 1) * w + clamp(x - dx, 0, w - 1)]) * k, i = (y * w + x) * 4;
        if (p.mode === 'gray') d[i] = d[i + 1] = d[i + 2] = 128 + df; else { d[i] += df; d[i + 1] += df; d[i + 2] += df; }
      } }); } },
  mirror: { name: 'Mirror', desc: 'Mirror halves / kaleidoscope', hue: 285, params: [S('mode', 'Mode', [['lr', 'Left → right'], ['rl', 'Right → left'], ['tb', 'Top → bottom'], ['bt', 'Bottom → top'], ['quad', 'Four-way']], 'quad')],
    run(cv, p) {
      const g = cv.getContext('2d'), W = cv.width, H = cv.height, hw = W >> 1, hh = H >> 1;
      const horiz = fromLeft => { const cp = copyOf(cv); g.save(); if (fromLeft) { g.translate(W, 0); g.scale(-1, 1); g.drawImage(cp, 0, 0, hw, H, 0, 0, hw, H); } else { g.translate(hw, 0); g.scale(-1, 1); g.drawImage(cp, W - hw, 0, hw, H, 0, 0, hw, H); } g.restore(); };
      const vert = fromTop => { const cp = copyOf(cv); g.save(); if (fromTop) { g.translate(0, H); g.scale(1, -1); g.drawImage(cp, 0, 0, W, hh, 0, 0, W, hh); } else { g.translate(0, hh); g.scale(1, -1); g.drawImage(cp, 0, H - hh, W, hh, 0, 0, W, hh); } g.restore(); };
      if (p.mode === 'lr') horiz(true); else if (p.mode === 'rl') horiz(false); else if (p.mode === 'tb') vert(true); else if (p.mode === 'bt') vert(false); else { horiz(true); vert(true); } } },
  pixelsort: { name: 'Pixel sort', desc: 'Smeared streaks of sorted pixels', hue: 310, params: [R('low', 'From brightness', 0, 255, 1, 70), R('high', 'To brightness', 0, 255, 1, 230), S('dir', 'Direction', [['h', 'Horizontal'], ['v', 'Vertical']], 'h'), C('reverse', 'Brightest first', false)],
    run(cv, p) { px(cv, id => {
      const { width: w, height: hh, data: d } = id, Hz = p.dir === 'h', lines = Hz ? hh : w, len = Hz ? w : hh, lum = new Float32Array(len), buf = new Uint8ClampedArray(len * 3);
      for (let l = 0; l < lines; l++) {
        const at = k => (Hz ? l * w + k : k * w + l) * 4;
        for (let k = 0; k < len; k++) { const i = at(k); buf[k * 3] = d[i]; buf[k * 3 + 1] = d[i + 1]; buf[k * 3 + 2] = d[i + 2]; lum[k] = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; }
        let k = 0;
        while (k < len) {
          if (lum[k] < p.low || lum[k] > p.high) { k++; continue; }
          let e = k; while (e < len && lum[e] >= p.low && lum[e] <= p.high) e++;
          const idx = Array.from({ length: e - k }, (_, t) => k + t).sort((a, b) => p.reverse ? lum[b] - lum[a] : lum[a] - lum[b]);
          idx.forEach((s, t) => { const i = at(k + t); d[i] = buf[s * 3]; d[i + 1] = buf[s * 3 + 1]; d[i + 2] = buf[s * 3 + 2]; });
          k = e;
        }
      } }); } },
  bulge: { name: 'Lens warp', desc: 'Fisheye bulge / pinch', hue: 195, params: [R('amount', 'Amount (− pinch, + bulge)', -100, 100, 1, 60), R('radius', 'Radius', 10, 150, 1, 100)],
    run(cv, p) { px(cv, id => {
      const { width: w, height: hh, data: d } = id, o = new Uint8ClampedArray(d), cx = w / 2, cy = hh / 2, R0 = Math.min(w, hh) / 2 * p.radius / 100, e = p.amount >= 0 ? 1 + p.amount / 50 : 1 / (1 - p.amount / 50);
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy); if (r >= R0 || r === 0) continue;
        const s = Math.pow(r / R0, e) * R0 / r, fx = clamp(cx + dx * s, 0, w - 1.001), fy = clamp(cy + dy * s, 0, hh - 1.001), x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const a = o[(y0 * w + x0) * 4 + c], b = o[(y0 * w + x0 + 1) * 4 + c], cc = o[((y0 + 1) * w + x0) * 4 + c], dd = o[((y0 + 1) * w + x0 + 1) * 4 + c];
          d[i + c] = (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + dd * tx) * ty;
        }
      } }); } },
  tint: { name: 'Tint', desc: 'Overlay a color with a blend mode', hue: 15, params: [COL('color', 'Color', '#ff7a2f'), S('mode', 'Blend', [['color', 'Color'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['soft-light', 'Soft light'], ['hard-light', 'Hard light'], ['difference', 'Difference']], 'overlay'), R('amount', 'Amount', 0, 100, 1, 50)],
    run(cv, p) { const g = cv.getContext('2d'); g.save(); g.globalCompositeOperation = p.mode; g.globalAlpha = p.amount / 100; g.fillStyle = p.color; g.fillRect(0, 0, cv.width, cv.height); g.restore(); } },
  border: { name: 'Border', desc: 'Frame or polaroid edge', hue: 40, params: [R('size', 'Thickness', 1, 30, 1, 5), COL('color', 'Color', '#f6f1e7'), C('polaroid', 'Polaroid (thick bottom)', false)],
    run(cv, p) { const g = cv.getContext('2d'), W = cv.width, H = cv.height, s = Math.round(Math.min(W, H) * p.size / 100), b = p.polaroid ? s * 3 : s;
      g.fillStyle = p.color; g.fillRect(0, 0, W, s); g.fillRect(0, H - b, W, b); g.fillRect(0, 0, s, H); g.fillRect(W - s, 0, s, H); } },
};
const TYPE_KEYS = Object.keys(TYPES);
const accent = t => `hsl(${TYPES[t].hue} 80% 62%)`;

/* ================= state ================= */
function newBlock(type, palette) {
  const p = {};
  for (const d of TYPES[type].params) p[d.k] = d.t === 'palette' ? (palette || PRESETS['Sunset']).slice() : d.def;
  return { id: uid(), type, on: true, c: false, p };
}
const lastPalette = () => { for (let i = state.blocks.length - 1; i >= 0; i--) if (state.blocks[i].p.palette) return state.blocks[i].p.palette; };
const DEFAULTS = () => {
  const pal = PRESETS['Sunset'], bl = [newBlock('posterize', pal), newBlock('noise'), newBlock('pixelate'), newBlock('compress'), newBlock('dither', pal)];
  return { maxDim: 1200, blocks: bl, mode: 'simple', preset: 'Sunset Pixel', mix: 100, rot: 0, flip: false, fmt: 'png', q: 92 };
};

/* ---- looks (presets) ---- */
const mkb = (type, p = {}, pal) => { const b = newBlock(type, pal); Object.assign(b.p, p); return b; };
const grad = (stops, n = 16) => { const rgb = stops.map(hexToRgb); return Array.from({ length: n }, (_, i) => { const t = i / (n - 1) * (rgb.length - 1), a = Math.floor(t), b = Math.min(rgb.length - 1, a + 1), f = t - a; return rgbToHex(...rgb[a].map((v, k) => v + (rgb[b][k] - v) * f)); }); };
const LOOKS = [];
// knobs: [path, label]; path 'type.param' (first block of that type); 'a.x|b.y' links several params
const L = (name, spec, knobs = []) => LOOKS.push({ name, knobs, build: () => spec.map(([t, p, pal]) => mkb(t, p, pal)) });
const PX = ['pixelate.size|gradient.scale', 'Pixel size'];
L('Matrix', [['adjust', { contrast: 30 }], ['pixelate', { size: 3 }], ['gradient', { method: 'cross', strength: 60, scale: 3 }, PRESETS['Matrix']], ['glow', {}], ['scanlines', { spacing: 3 }]],
  [PX, ['glow.strength', 'Glow'], ['scanlines.darkness', 'Scanlines'], ['adjust.brightness', 'Brightness']]);
L('Red Night', [['adjust', { contrast: 28, brightness: 4 }], ['pixelate', { size: 3 }], ['noise', { amount: 14, size: 3 }], ['gradient', { method: 'bayer4', strength: 70, scale: 3 }, PRESETS['Crimson Night']]],
  [['pixelate.size|noise.size|gradient.scale', 'Pixel size'], ['adjust.brightness', 'Brightness'], ['noise.amount', 'Grain'], ['gradient.strength', 'Dither']]);
L('Sunset Pixel', [['posterize', {}, PRESETS['Sunset']], ['noise', { amount: 30 }], ['pixelate', { size: 4 }], ['compress', {}], ['dither', {}, PRESETS['Sunset']]],
  [['pixelate.size|compress.scale', 'Pixel size'], ['noise.amount', 'Noise'], ['compress.quality', 'Compression quality'], ['dither.strength', 'Dither']]);
L('Game Boy', [['adjust', { contrast: 20 }], ['pixelate', { size: 4 }], ['gradient', { method: 'bayer8', strength: 80, scale: 4 }, PRESETS['Game Boy']]],
  [['pixelate.size|gradient.scale', 'Pixel size'], ['adjust.contrast', 'Contrast'], ['adjust.brightness', 'Brightness'], ['gradient.strength', 'Dither']]);
L('Glitch TV', [['rgbshift', { amount: 10 }], ['glitch', {}], ['scanlines', {}], ['vignette', {}]],
  [['rgbshift.amount', 'RGB split'], ['glitch.intensity', 'Glitch'], ['glitch.slices', 'Glitch slices'], ['scanlines.darkness', 'Scanlines']]);
L('VHS', [['adjust', { saturation: -15, contrast: -10, brightness: 6 }], ['blur', { radius: 1 }], ['rgbshift', { amount: 5, angle: 0 }], ['noise', { amount: 24, size: 2 }], ['glitch', { slices: 5, intensity: 15 }], ['scanlines', { spacing: 3, darkness: 30 }], ['vignette', { strength: 45 }]],
  [['rgbshift.amount', 'Color bleed'], ['noise.amount', 'Tape noise'], ['glitch.intensity', 'Tracking glitch'], ['scanlines.darkness', 'Scanlines']]);
L('Amber Terminal', [['adjust', { contrast: 25 }], ['pixelate', { size: 2 }], ['gradient', { method: 'cross', strength: 60, scale: 2 }, ['#000000', '#2b1600', '#7a4300', '#ffb000', '#ffe9a8']], ['glow', { threshold: 130, radius: 10, strength: 90 }], ['scanlines', { spacing: 3, darkness: 40 }]],
  [PX, ['glow.strength', 'Glow'], ['scanlines.darkness', 'Scanlines'], ['adjust.brightness', 'Brightness']].map(k => k));
L('Newspaper', [['adjust', { saturation: -100, contrast: 35 }], ['halftone', { cell: 7, color: false, invert: true }], ['noise', { amount: 10 }]],
  [['halftone.cell', 'Dot size'], ['adjust.contrast', 'Contrast'], ['adjust.brightness', 'Brightness'], ['noise.amount', 'Paper grain']]);
L('Pop Art', [['adjust', { saturation: 40, contrast: 30 }], ['posterize', {}, ['#111111', '#e63946', '#f4c430', '#1d6fd6', '#f8f4e3']], ['edges', { mode: 'overlay', strength: 85 }]],
  [['adjust.contrast', 'Contrast'], ['adjust.brightness', 'Brightness'], ['edges.strength', 'Outlines']]);
L('Color Halftone', [['adjust', { saturation: 50, contrast: 25 }], ['halftone', { cell: 9, color: true, invert: false }]],
  [['halftone.cell', 'Dot size'], ['halftone.invert', 'Dark dots on paper'], ['adjust.saturation', 'Saturation'], ['adjust.contrast', 'Contrast']]);
L('Thermal Cam', [['blur', { radius: 2 }], ['gradient', { method: 'none' }, ['#00004d', '#4b0082', '#b3123e', '#ff6a00', '#ffe100', '#ffffff']], ['noise', { amount: 10, size: 2 }]],
  [['blur.radius', 'Smoothing'], ['noise.amount', 'Sensor noise']]);
L('Vaporwave', [['adjust', { saturation: 20, contrast: 15 }], ['pixelate', { size: 2 }], ['gradient', { method: 'bayer8', strength: 70, scale: 2 }, PRESETS['Vaporwave']], ['rgbshift', { amount: 6, angle: 0 }], ['scanlines', { spacing: 4, darkness: 25 }]],
  [PX, ['rgbshift.amount', 'RGB split'], ['scanlines.darkness', 'Scanlines'], ['adjust.brightness', 'Brightness']]);
L('Cyberpunk', [['adjust', { contrast: 25, saturation: 30 }], ['gradient', { method: 'bayer4', strength: 50, scale: 2 }, PRESETS['Neon']], ['glow', { threshold: 140, radius: 14, strength: 120 }], ['rgbshift', { amount: 7, angle: 20 }]],
  [['glow.strength', 'Glow'], ['rgbshift.amount', 'RGB split'], ['gradient.strength', 'Dither'], ['adjust.brightness', 'Brightness']]);
L('Blueprint', [['blur', { radius: 1 }], ['edges', { mode: 'only', strength: 100 }], ['gradient', { method: 'none' }, ['#0a2a66', '#2c6bd6', '#eaf2ff']], ['noise', { amount: 8, size: 2 }]],
  [['edges.strength', 'Line strength'], ['blur.radius', 'Simplify'], ['noise.amount', 'Paper grain']]);
L('Pencil Sketch', [['blur', { radius: 1 }], ['edges', { mode: 'only', strength: 100 }], ['invert', {}], ['gradient', { method: 'none' }, ['#1c1c20', '#b9b5aa', '#f5f1e6']], ['noise', { amount: 10, size: 2 }]],
  [['edges.strength', 'Line strength'], ['blur.radius', 'Simplify'], ['noise.amount', 'Paper grain']]);
L('Noir Film', [['adjust', { saturation: -100, contrast: 35 }], ['noise', { amount: 28 }], ['vignette', { strength: 80, size: 30 }]],
  [['adjust.contrast', 'Contrast'], ['adjust.brightness', 'Brightness'], ['noise.amount', 'Film grain'], ['vignette.strength', 'Vignette']]);
L('Sepia Photo', [['adjust', { saturation: -100, contrast: 10 }], ['gradient', { method: 'none' }, grad(['#1b1008', '#85603a', '#fff3d6'])], ['noise', { amount: 12 }], ['vignette', { strength: 50, size: 35 }]],
  [['adjust.contrast', 'Contrast'], ['adjust.brightness', 'Brightness'], ['noise.amount', 'Grain'], ['vignette.strength', 'Vignette']]);
L('Deep Fried', [['adjust', { saturation: 90, contrast: 55 }], ['noise', { amount: 25, mono: false }], ['compress', { quality: 6, passes: 4, scale: 1 }], ['glow', { threshold: 170, radius: 6, strength: 70 }]],
  [['compress.quality', 'Crunch (lower = worse)'], ['compress.passes', 'Fry passes'], ['noise.amount', 'Noise'], ['glow.strength', 'Glow']]);
L('Dreamy', [['blur', { radius: 3 }], ['glow', { threshold: 100, radius: 25, strength: 110 }], ['adjust', { brightness: 8, saturation: 15, contrast: -5 }]],
  [['blur.radius', 'Softness'], ['glow.strength', 'Glow'], ['glow.radius', 'Glow size'], ['adjust.saturation', 'Saturation']]);
L('1-bit', [['adjust', { contrast: 15 }], ['pixelate', { size: 2 }], ['gradient', { method: 'bayer8', strength: 100, scale: 2 }, ['#000000', '#ffffff']]],
  [PX, ['gradient.method', 'Pattern'], ['adjust.brightness', 'Brightness'], ['adjust.contrast', 'Contrast']]);
L('Retro Poster', [['adjust', { contrast: 30, saturation: 30 }], ['posterize', {}, ['#1d1a2f', '#c8412b', '#f2b134', '#f5ecd5']], ['noise', { amount: 10, size: 2 }], ['vignette', { strength: 40, size: 40 }]],
  [['adjust.contrast', 'Contrast'], ['adjust.saturation', 'Saturation'], ['noise.amount', 'Grain'], ['vignette.strength', 'Vignette']]);
L('NES 8-bit', [['adjust', { contrast: 15, saturation: 20 }], ['pixelate', { size: 6 }], ['dither', { method: 'bayer4', strength: 35, scale: 6 }, ['#000000', '#fcfcfc', '#bcbcbc', '#7c7c7c', '#a80020', '#e45c10', '#f8b800', '#00a800', '#005800', '#00a8a8', '#0058f8', '#6844fc', '#d800cc', '#f878f8', '#503000', '#fcd8a8']]],
  [['pixelate.size|dither.scale', 'Pixel size'], ['dither.strength', 'Dither'], ['adjust.saturation', 'Saturation'], ['adjust.contrast', 'Contrast']]);
L('CGA 4-color', [['adjust', { contrast: 20, saturation: 40 }], ['pixelate', { size: 3 }], ['dither', { method: 'bayer4', strength: 100, scale: 3 }, PRESETS['CGA']]],
  [['pixelate.size|dither.scale', 'Pixel size'], ['dither.method', 'Pattern'], ['dither.strength', 'Dither'], ['adjust.saturation', 'Saturation']]);
L('Infrared', [['adjust', { contrast: 20 }], ['gradient', { method: 'bayer4', strength: 40, scale: 1 }, ['#1a0010', '#7a0050', '#ff3c8e', '#ffd0e0', '#ffffff']], ['glow', { threshold: 200, radius: 8, strength: 60 }]],
  [['adjust.contrast', 'Contrast'], ['adjust.brightness', 'Brightness'], ['glow.strength', 'Glow']]);
L('X-Ray', [['adjust', { saturation: -100, contrast: 10 }], ['invert', {}], ['gradient', { method: 'none' }, grad(['#000814', '#1a6fb5', '#eaffff'], 12)], ['glow', { threshold: 150, radius: 10, strength: 60 }], ['noise', { amount: 10 }]],
  [['adjust.contrast', 'Contrast'], ['adjust.brightness', 'Brightness'], ['glow.strength', 'Glow'], ['noise.amount', 'Noise']]);
L('Photocopy', [['adjust', { saturation: -100, contrast: 60, brightness: 10 }], ['noise', { amount: 40 }], ['gradient', { method: 'none' }, ['#111111', '#f2f2f0']]],
  [['adjust.brightness', 'Threshold'], ['adjust.contrast', 'Contrast'], ['noise.amount', 'Toner noise']]);
L('Risograph', [['adjust', { contrast: 20 }], ['noise', { amount: 20, size: 2 }], ['gradient', { method: 'bayer4', strength: 50, scale: 2 }, ['#10163a', '#3a46c9', '#ff4f8b', '#fff1dd']]],
  [['noise.amount', 'Grain'], ['gradient.strength', 'Dither'], ['gradient.scale', 'Dither size'], ['adjust.contrast', 'Contrast']]);
L('Ocean Dither', [['adjust', { contrast: 10 }], ['pixelate', { size: 3 }], ['gradient', { method: 'bayer8', strength: 85, scale: 3 }, PRESETS['Ice Blue']]],
  [PX, ['gradient.strength', 'Dither'], ['adjust.brightness', 'Brightness'], ['adjust.contrast', 'Contrast']]);
L('Golden Hour', [['adjust', { contrast: 15, brightness: 4 }], ['gradient', { method: 'none' }, grad(['#1a1203', '#8f6a14', '#f7d96b', '#fff6d6'])], ['glow', { threshold: 170, radius: 16, strength: 60 }], ['vignette', { strength: 40, size: 40 }]],
  [['adjust.brightness', 'Brightness'], ['adjust.contrast', 'Contrast'], ['glow.strength', 'Glow'], ['vignette.strength', 'Vignette']]);
L('Teal & Orange', [['adjust', { contrast: 20 }], ['gradient', { method: 'none' }, grad(['#04222c', '#1f8a8a', '#ffd9a0', '#ff7a2f'])], ['noise', { amount: 6 }], ['vignette', { strength: 30 }]],
  [['adjust.brightness', 'Brightness'], ['adjust.contrast', 'Contrast'], ['noise.amount', 'Grain'], ['vignette.strength', 'Vignette']]);
L('Duotone Pink', [['adjust', { contrast: 20 }], ['gradient', { method: 'bayer8', strength: 40, scale: 2 }, ['#1b0a3c', '#ff5ea8', '#ffe9f2']]],
  [['adjust.brightness', 'Brightness'], ['adjust.contrast', 'Contrast'], ['gradient.strength', 'Dither'], ['gradient.method', 'Pattern']]);
L('Glitch Art', [['pixelate', { size: 2 }], ['glitch', { slices: 30, intensity: 70 }], ['rgbshift', { amount: 12, angle: 15 }], ['adjust', { saturation: 50, contrast: 20 }], ['scanlines', { spacing: 4, darkness: 30 }]],
  [['glitch.intensity', 'Glitch'], ['glitch.slices', 'Slices'], ['rgbshift.amount', 'RGB split'], ['pixelate.size', 'Pixel size']]);
L('Trippy Waves', [['adjust', { saturation: 60, contrast: 10 }], ['wave', { amplitude: 16, length: 100, dir: 'h' }], ['wave', { amplitude: 10, length: 140, dir: 'v' }], ['rgbshift', { amount: 5, angle: 0 }], ['glow', { threshold: 150, radius: 14, strength: 70 }]],
  [['wave.amplitude', 'Wobble'], ['wave.length', 'Wave size'], ['rgbshift.amount', 'RGB split'], ['glow.strength', 'Glow']]);
L('Pixel Sort', [['pixelsort', { low: 70, high: 230, dir: 'h' }], ['adjust', { saturation: 30, contrast: 10 }]],
  [['pixelsort.low', 'Sort from'], ['pixelsort.high', 'Sort to'], ['pixelsort.dir', 'Direction'], ['pixelsort.reverse', 'Brightest first']]);
L('Kaleidoscope', [['mirror', { mode: 'quad' }], ['adjust', { saturation: 50, contrast: 15 }], ['glow', { threshold: 150, radius: 12, strength: 60 }]],
  [['mirror.mode', 'Mirror'], ['adjust.saturation', 'Saturation'], ['glow.strength', 'Glow']]);
L('Mirror World', [['mirror', { mode: 'lr' }], ['adjust', { saturation: 25 }], ['vignette', { strength: 40, size: 40 }]],
  [['mirror.mode', 'Mirror'], ['adjust.saturation', 'Saturation'], ['vignette.strength', 'Vignette']]);
L('Embossed Metal', [['adjust', { saturation: -100, contrast: 10 }], ['emboss', { strength: 80, angle: 135, mode: 'gray' }], ['tint', { color: '#8fb4ff', mode: 'overlay', amount: 35 }]],
  [['emboss.strength', 'Depth'], ['emboss.angle', 'Light angle'], ['tint.color', 'Metal tint'], ['tint.amount', 'Tint amount']]);
L('Fisheye Cam', [['bulge', { amount: 60, radius: 100 }], ['rgbshift', { amount: 4, angle: 0 }], ['adjust', { saturation: 20, contrast: 10 }], ['vignette', { strength: 70, size: 30 }]],
  [['bulge.amount', 'Lens'], ['rgbshift.amount', 'RGB split'], ['vignette.strength', 'Vignette']]);
L('Polaroid', [['adjust', { contrast: -8, saturation: -10, brightness: 6 }], ['tint', { color: '#ffb86b', mode: 'soft-light', amount: 45 }], ['noise', { amount: 10 }], ['vignette', { strength: 35, size: 45 }], ['border', { size: 6, polaroid: true, color: '#f6f1e7' }]],
  [['tint.color', 'Warmth tint'], ['tint.amount', 'Tint amount'], ['noise.amount', 'Grain'], ['border.size', 'Border'], ['border.color', 'Border color']]);
L('Crisp HDR', [['sharpen', { amount: 150, radius: 2 }], ['adjust', { contrast: 20, saturation: 30 }]],
  [['sharpen.amount', 'Sharpness'], ['adjust.contrast', 'Contrast'], ['adjust.saturation', 'Saturation'], ['adjust.brightness', 'Brightness']]);
L('Neon Edges', [['blur', { radius: 1 }], ['edges', { mode: 'only', strength: 100 }], ['gradient', { method: 'none' }, grad(['#000000', '#3a1cff', '#ff2fa0', '#ffffff'], 8)], ['glow', { threshold: 60, radius: 10, strength: 150 }]],
  [['edges.strength', 'Line strength'], ['blur.radius', 'Simplify'], ['glow.strength', 'Glow']]);
// size-like params that must shrink with the image when rendering small thumbnails
const SZ = { sharpen: ['radius'], noise: ['size'], pixelate: ['size'], compress: ['scale'], dither: ['scale'], gradient: ['scale'], blur: ['radius'], glow: ['radius'], rgbshift: ['amount'], wave: ['amplitude', 'length'], scanlines: ['spacing'], halftone: ['cell'] };
function scaleP(type, p, f) { if (f === 1 || !SZ[type]) return p; const q = { ...p }; for (const k of SZ[type]) q[k] = Math.max(1, Math.round(p[k] * f)); return q; }
async function runChain(blocks, base, f = 1) {
  const cv = copyOf(base);
  for (const b of blocks) if (b.on) { try { await TYPES[b.type].run(cv, scaleP(b.type, b.p, f)); } catch (e) { console.error(b.type, e); } }
  return cv;
}
let state = DEFAULTS();
function sanitize(s) { // rebuild state from saved data, tolerant of old/odd shapes
  if (!s || !Array.isArray(s.blocks)) return null;
  const blocks = [];
  for (const b of s.blocks) {
    if (!b || !TYPES[b.type]) continue;
    const nb = newBlock(b.type); nb.on = b.on !== false; nb.c = !!b.c;
    for (const d of TYPES[b.type].params) {
      const v = b.p && b.p[d.k]; if (v === undefined) continue;
      if (d.t === 'palette') { if (Array.isArray(v) && v.length >= 2 && v.length <= 16 && v.every(c => /^#[0-9a-f]{6}$/i.test(c))) nb.p[d.k] = v.slice(); }
      else if (typeof v === typeof d.def && (d.t !== 'color' || /^#[0-9a-f]{6}$/i.test(v))) nb.p[d.k] = v;
    }
    blocks.push(nb);
  }
  return { maxDim: [600, 900, 1200, 1600, 2400].includes(s.maxDim) ? s.maxDim : 1200, blocks,
    mode: s.mode === 'simple' ? 'simple' : 'advanced', preset: LOOKS.some(l => l.name === s.preset) ? s.preset : null,
    mix: typeof s.mix === 'number' ? clamp(s.mix, 0, 100) : 100,
    rot: [0, 90, 180, 270].includes(s.rot) ? s.rot : 0, flip: !!s.flip, fmt: ['png', 'jpeg', 'webp'].includes(s.fmt) ? s.fmt : 'png', q: typeof s.q === 'number' ? clamp(s.q, 40, 100) : 92 };
}

/* ================= persistence ================= */
const dbp = (() => {
  try { return new Promise((res, rej) => { const r = indexedDB.open('image-styler', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  catch (e) { return Promise.reject(e); }
})();
dbp.catch(() => { $('#storeHint').textContent = 'Storage unavailable in this browser mode — changes will not be remembered.'; });
const kv = (mode, fn) => dbp.then(db => new Promise((res, rej) => { const q = fn(db.transaction('kv', mode).objectStore('kv')); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
const kvGet = k => kv('readonly', s => s.get(k)).catch(() => undefined);
const kvSet = (k, v) => kv('readwrite', s => s.put(v, k)).catch(() => {});
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
let saveTimer;
const saveSettings = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => kvSet('stack', state), 300); pushHist(); };
const touch = () => { if (state.mode === 'advanced' && state.preset) { state.preset = null; markSelected(); } saveSettings(); schedule(); };

/* ================= source image ================= */
let srcBitmap = null, srcName = 'image', src = null;
async function loadBlob(blob, name, persist = true) {
  let bmp; try { bmp = await createImageBitmap(blob); } catch (e) { alert('Could not read that image.'); return; }
  srcBitmap = bmp; srcName = (name || 'image').replace(/\.[^.]+$/, '');
  if (persist) { kvSet('image', { blob, name: srcName }); state.rot = 0; state.flip = false; }
  buildSrc(); $('#drop').hidden = true; $('#canvasWrap').hidden = false; $('#btnSave').disabled = false; schedule(); if (state.mode === 'simple') buildThumbs();
}
let srcVer = 0, cache = [];
function buildSrc() {
  if (!srcBitmap) return;
  srcVer++; cache = [];
  const sc = Math.min(1, state.maxDim / Math.max(srcBitmap.width, srcBitmap.height)), bw = Math.round(srcBitmap.width * sc), bh = Math.round(srcBitmap.height * sc);
  const sw = state.rot % 180 ? bh : bw, sh = state.rot % 180 ? bw : bh;
  src = mk(sw, sh); const c = src.getContext('2d'); c.imageSmoothingQuality = 'high';
  c.translate(sw / 2, sh / 2); c.rotate(state.rot * Math.PI / 180); if (state.flip) c.scale(-1, 1); c.drawImage(srcBitmap, -bw / 2, -bh / 2, bw, bh);
}
function makeSample() {
  const c = mk(900, 600), g = c.getContext('2d'), sky = g.createLinearGradient(0, 0, 0, 600);
  sky.addColorStop(0, '#1a1a4e'); sky.addColorStop(.5, '#d6457a'); sky.addColorStop(1, '#ffc27a'); g.fillStyle = sky; g.fillRect(0, 0, 900, 600);
  const sun = g.createRadialGradient(450, 330, 10, 450, 330, 190);
  sun.addColorStop(0, '#fffbe0'); sun.addColorStop(.4, '#ffd36e'); sun.addColorStop(1, 'rgba(255,150,80,0)');
  g.fillStyle = sun; g.beginPath(); g.arc(450, 330, 190, 0, 7); g.fill();
  g.fillStyle = '#1b1530'; g.beginPath(); g.moveTo(0, 600); g.lineTo(0, 440);
  for (let x = 0; x <= 900; x += 30) g.lineTo(x, 430 - 60 * Math.abs(Math.sin(x / 140)) - 30 * Math.sin(x / 47));
  g.lineTo(900, 600); g.fill(); g.fillStyle = '#0c0a18'; g.fillRect(0, 520, 900, 80);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ================= render ================= */
const out = $('#out'), origCv = $('#orig'), octx = out.getContext('2d');
let token = 0, raf = 0;
function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }
async function render() {
  if (!src) return;
  const tok = ++token, W = src.width, H = src.height, steps = state.blocks.filter(b => b.on), keys = [];
  let acc = 'v' + srcVer; for (const b of steps) { acc += '|' + b.type + JSON.stringify(b.p); keys.push(acc); }
  // reuse cached results for the unchanged leading modifiers; only re-run from the first changed one
  let i = 0; while (i < steps.length && cache[i] && cache[i].key === keys[i]) i++;
  let prev = i ? cache[i - 1].cv : src;
  for (; i < steps.length; i++) {
    const cv = copyOf(prev);
    try { await TYPES[steps[i].type].run(cv, steps[i].p); } catch (e) { console.error(steps[i].type, e); }
    if (tok !== token) return;
    cache[i] = { key: keys[i], cv }; prev = cv;
  }
  cache.length = steps.length;
  out.width = W; out.height = H;
  if (state.mix < 100) { octx.drawImage(src, 0, 0); octx.globalAlpha = state.mix / 100; }
  octx.drawImage(prev, 0, 0); octx.globalAlpha = 1;
  origCv.width = W; origCv.height = H; origCv.getContext('2d').drawImage(src, 0, 0);
  $('#info').textContent = `${W} × ${H}px`; fitClass();
}
function fitClass() { out.classList.toggle('pix', out.clientWidth > out.width); origCv.className = out.className; }
window.addEventListener('resize', () => src && fitClass());

/* ================= sheet (bottom sheet / popover) ================= */
const sheet = $('#sheet');
let sheetClosed = null;
function openSheet(title, body, { light = false, onClose } = {}) {
  $('#sheetTitle').textContent = title; const sb = $('#sheetBody'); sb.innerHTML = ''; sb.append(body);
  sheet.classList.toggle('light', light); sheet.hidden = false; sheetClosed = onClose || null;
}
function closeSheet() { if (sheet.hidden) return; sheet.hidden = true; const f = sheetClosed; sheetClosed = null; f && f(); }
$('#sheetBg').addEventListener('click', closeSheet);
$('#sheetClose').addEventListener('click', closeSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ================= color picker ================= */
function openColorPicker(hex, onChange, title) {
  let [H, Sx, V] = rgbToHsv(...hexToRgb(hex));
  const sv = h('div', { class: 'cp-sv' }, h('div', { class: 'cp-knob' }));
  const hue = h('div', { class: 'cp-hue' }, h('div', { class: 'cp-knob' }));
  const prev = h('div', { class: 'cp-prev' });
  const hexIn = h('input', { class: 'cp-hex', maxlength: 7, spellcheck: 'false', autocapitalize: 'off', 'aria-label': 'Hex color' });
  const quick = h('div', { class: 'cp-quick' });
  const update = (emit = true, fromHex = false) => {
    const c = hsvHex(H, Sx, V);
    sv.style.setProperty('--h', Math.round(H)); sv.firstChild.style.cssText = `left:${Sx * 100}%;top:${(1 - V) * 100}%`;
    hue.firstChild.style.left = H / 360 * 100 + '%'; prev.style.background = c; if (!fromHex) hexIn.value = c;
    if (emit) onChange(c);
  };
  const drag = (el, fn) => {
    const move = e => { const r = el.getBoundingClientRect(); fn(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)); update(); };
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); move(e); el.onpointermove = move; });
    const end = () => { el.onpointermove = null; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  };
  drag(sv, (x, y) => { Sx = x; V = 1 - y; });
  drag(hue, x => { H = x * 359.999; });
  hexIn.addEventListener('input', () => {
    let v = hexIn.value.trim(); if (v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-f]{6}$/i.test(v)) { [H, Sx, V] = rgbToHsv(...hexToRgb(v)); update(true, true); }
  });
  // quick-pick: colors already used in the stack
  const used = [...new Set(state.blocks.flatMap(b => b.p.palette || []))].slice(0, 16);
  used.forEach(c => quick.append(h('button', { style: `background:${c}`, 'aria-label': c, onclick: () => { [H, Sx, V] = rgbToHsv(...hexToRgb(c)); update(); } })));
  update(false);
  openSheet(title || 'Pick a color', h('div', { class: 'cp' }, sv, hue, h('div', { class: 'cp-row' }, prev, hexIn), used.length ? quick : null), { light: true });
}

/* ================= block UI ================= */
const fmt = (d, v) => v;
function paletteEditor(b, k, opts = {}) {
  const after = () => { opts.sync && opts.sync(pal); touch(); };
  const pal = b.p[k], wrap = h('div', { class: 'row', style: 'gap:10px' });
  const cnt = h('input', { type: 'range', min: 2, max: 16, step: 1 }); cnt.value = pal.length;
  const cntOut = h('output', {}, pal.length);
  const box = h('div', { class: 'swatches' }), strip = h('div', { class: 'strip' }), pname = h('span');
  const setPal = arr => { pal.splice(0, pal.length, ...arr.slice(0, 16)); cnt.value = pal.length; cntOut.textContent = pal.length; draw(); after(); };
  const draw = () => {
    box.innerHTML = ''; strip.innerHTML = '';
    pal.forEach((c, i) => {
      const s = h('button', { class: 'swatch', style: `background:${c}`, 'aria-label': `Color ${i + 1}`, onclick: () => openColorPicker(pal[i], hx => { pal[i] = hx; s.style.background = hx; strip.children[i].style.background = hx; pname.textContent = ''; after(); }, `Color ${i + 1} of ${pal.length}`) });
      box.append(s); strip.append(h('i', { style: `background:${c}` }));
    });
    pname.textContent = presetName(pal) || 'Custom';
  };
  cnt.addEventListener('input', () => {
    const n = Number(cnt.value), rnd = mulberry32(n * 7919 + pal.length), p = pal.slice(0, n);
    while (p.length < n) p.push(hslHex(rnd() * 360, .6 + rnd() * .3, .3 + rnd() * .4));
    setPal(p);
  });
  const presetBtn = h('button', { class: 'btn small presetbtn', onclick: () => {
    const list = h('div', { class: 'plist' });
    for (const [n, cols] of Object.entries(PRESETS)) list.append(h('button', { class: 'prow', onclick: () => { setPal(cols); closeSheet(); } }, h('b', {}, n), h('div', { class: 'strip' }, cols.map(c => h('i', { style: `background:${c}` })))));
    openSheet('Palette presets', list);
  } }, strip, pname);
  const extract = h('button', { class: 'btn small', onclick: () => src && setPal(extractPalette(pal.length)) }, 'From image');
  const rand = h('button', { class: 'btn small', onclick: () => {
    const n = pal.length, rnd = mulberry32(Date.now() & 0xffff), h0 = rnd() * 360, p = [];
    for (let i = 0; i < n; i++) p.push(hslHex((h0 + i * (360 / n) * (.4 + rnd() * .6)) % 360, .5 + rnd() * .4, .1 + .8 * i / (n - 1)));
    setPal(p);
  } }, 'Random');
  draw();
  wrap.append(h('div', { class: 'row' }, h('label', {}, 'Colors', cntOut), cnt), box, h('div', { class: 'row inline' }, presetBtn, extract, rand));
  return wrap;
}
function extractPalette(k) {
  const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data, step = Math.max(1, Math.floor(d.length / 4 / 20000)), pts = [];
  for (let i = 0; i < d.length / 4; i += step) pts.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
  const rnd = mulberry32(5), cen = [pts[(rnd() * pts.length) | 0]];
  while (cen.length < k) {
    const ds = pts.map(p => Math.min(...cen.map(c => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)));
    let r = rnd() * ds.reduce((a, b) => a + b, 0), j = 0; while (j < ds.length - 1 && (r -= ds[j]) > 0) j++; cen.push(pts[j]);
  }
  for (let it = 0; it < 10; it++) {
    const sum = cen.map(() => [0, 0, 0, 0]);
    for (const p of pts) { const s = sum[nearest(cen, p[0], p[1], p[2])]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; }
    sum.forEach((s, i) => { if (s[3]) cen[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  cen.sort((a, b) => (a[0] * .3 + a[1] * .59 + a[2] * .11) - (b[0] * .3 + b[1] * .59 + b[2] * .11));
  return cen.map(c => rgbToHex(...c));
}
function paramEl(b, d) {
  if (d.t === 'range') {
    const o = h('output', {}, b.p[d.k]), i = h('input', { type: 'range', min: d.min, max: d.max, step: d.step }); i.value = b.p[d.k];
    i.addEventListener('input', () => { b.p[d.k] = Number(i.value); o.textContent = i.value; touch(); });
    return h('div', { class: 'row' }, h('label', {}, d.label, o), i);
  }
  if (d.t === 'select') {
    const s = h('select', {}, d.opts.map(([v, l]) => h('option', { value: v }, l))); s.value = b.p[d.k];
    s.addEventListener('change', () => { b.p[d.k] = s.value; touch(); });
    return h('div', { class: 'row' }, h('label', {}, d.label), s);
  }
  if (d.t === 'check') {
    const i = h('input', { type: 'checkbox' }); i.checked = b.p[d.k];
    i.addEventListener('change', () => { b.p[d.k] = i.checked; touch(); });
    return h('label', { class: 'check' }, i, d.label);
  }
  if (d.t === 'color') {
    const sw = h('button', { class: 'swatch', style: `background:${b.p[d.k]};width:46px;aspect-ratio:auto;height:34px;flex:none`, 'aria-label': d.label,
      onclick: () => openColorPicker(b.p[d.k], hx => { b.p[d.k] = hx; sw.style.background = hx; touch(); }, d.label) });
    return h('div', { class: 'row inline' }, h('label', { style: 'flex:1' }, d.label), sw);
  }
  if (d.t === 'seed') return h('button', { class: 'btn small', style: 'align-self:flex-start', onclick: () => { b.p.seed = (Math.random() * 1e9) | 0; touch(); } }, '🎲 Reroll');
  if (d.t === 'palette') return paletteEditor(b, d.k);
}
function blockEl(b, i) {
  const T = TYPES[b.type], n = state.blocks.length;
  const tog = h('input', { type: 'checkbox', 'aria-label': 'Enable' }); tog.checked = b.on;
  const card = h('section', { class: 'card' + (b.on ? '' : ' off') + (b.c ? ' collapsed' : ''), style: `--bc:${accent(b.type)}` });
  tog.addEventListener('change', () => { b.on = tog.checked; card.classList.toggle('off', !b.on); touch(); });
  const move = d => () => { const j = i + d; if (j < 0 || j >= n) return; [state.blocks[i], state.blocks[j]] = [state.blocks[j], state.blocks[i]]; renderBlocks(); touch(); };
  const title = h('h2', { class: 'tap', onclick: () => { b.c = !b.c; card.classList.toggle('collapsed', b.c); saveSettings(); } }, h('span', { class: 'chev' }, '▾'), ` ${i + 1} · ${T.name}`);
  const grip = h('button', { class: 'ib grip', title: 'Drag to reorder', 'aria-label': 'Drag to reorder' }, '⠿');
  grip.addEventListener('pointerdown', e => {
    e.preventDefault(); grip.setPointerCapture(e.pointerId); const y0 = e.clientY; card.classList.add('drag');
    grip.onpointermove = ev => { card.style.transform = `translateY(${ev.clientY - y0}px)`; };
    const end = ev => {
      grip.onpointermove = grip.onpointerup = grip.onpointercancel = null; card.classList.remove('drag'); card.style.transform = '';
      let to = 0; $$('#blocks .card').forEach((c, j) => { if (j !== i) { const r = c.getBoundingClientRect(); if (r.top + r.height / 2 < ev.clientY) to++; } });
      if (to !== i) { const [bb] = state.blocks.splice(i, 1); state.blocks.splice(to, 0, bb); renderBlocks(); touch(); }
    };
    grip.onpointerup = grip.onpointercancel = end;
  });
  card.append(h('header', {},
    h('label', { class: 'sw-toggle' }, tog, h('span')), title, grip,
    h('button', { class: 'ib mv', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: move(-1) }, '▲'),
    h('button', { class: 'ib mv', title: 'Move down', 'aria-label': 'Move down', disabled: i === n - 1, onclick: move(1) }, '▼'),
    h('button', { class: 'ib', title: 'Duplicate', 'aria-label': 'Duplicate', onclick: () => { const c = JSON.parse(JSON.stringify(b)); c.id = uid(); state.blocks.splice(i + 1, 0, c); renderBlocks(); touch(); } }, '⧉'),
    h('button', { class: 'ib', title: 'Remove', 'aria-label': 'Remove', onclick: () => { state.blocks.splice(i, 1); renderBlocks(); touch(); } }, '✕')));
  card.append(h('div', { class: 'body' }, T.params.map(d => paramEl(b, d))));
  return card;
}
function renderBlocks() {
  const box = $('#blocks'); box.innerHTML = '';
  if (!state.blocks.length) box.append(h('p', { class: 'empty' }, 'No modifiers — the original image is shown. Add one!'));
  state.blocks.forEach((b, i) => box.appendChild(blockEl(b, i)));
}
function openAddMenu() {
  const g = h('div', { class: 'tiles' });
  for (const k of TYPE_KEYS) g.append(h('button', { class: 'tile', style: `--bc:${accent(k)}`, onclick: () => {
    state.blocks.push(newBlock(k, lastPalette())); closeSheet(); renderBlocks(); touch();
    const cards = $$('#blocks .card'); cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
  } }, h('b', {}, TYPES[k].name), h('small', {}, TYPES[k].desc)));
  openSheet('Add modifier', g);
}
$$('[data-add]').forEach(b => b.addEventListener('click', openAddMenu));

/* ================= output / looks / io ================= */
const stBox = $('#starters');
for (const l of LOOKS) stBox.append(h('button', { class: 'chip', onclick: () => applyLook(l.name) }, l.name));

/* ---- simple mode ---- */
const cards = {};
for (const l of LOOKS) {
  const pal = l.build().map(b => b.p.palette).filter(Boolean).pop() || ['#222222', '#888888', '#dddddd'];
  const th = h('div', { class: 'thumb', style: `background:linear-gradient(90deg,${pal.map((c, i) => `${c} ${i / pal.length * 100}% ${(i + 1) / pal.length * 100}%`).join(',')})` });
  const card = h('button', { class: 'look-card', onclick: () => applyLook(l.name) }, th, h('span', {}, l.name));
  cards[l.name] = { card, th }; $('#lookGrid').append(card);
}
function markSelected() { for (const [n, c] of Object.entries(cards)) c.card.classList.toggle('sel', n === state.preset); }
function applyLook(name) {
  const l = LOOKS.find(x => x.name === name); if (!l) return;
  state.blocks = l.build(); state.preset = name; renderBlocks(); renderSimple(); markSelected(); saveSettings(); schedule();
}
function mixRow() {
  const o = h('output', {}, state.mix), i = h('input', { type: 'range', min: 0, max: 100, step: 1 }); i.value = state.mix;
  i.addEventListener('input', () => { state.mix = Number(i.value); o.textContent = i.value; saveSettings(); schedule(); });
  return h('div', { class: 'row' }, h('label', {}, 'Overall strength', o), i);
}
function knobEl(paths, label) {
  const targets = paths.split('|').map(p => { const [t, k] = p.split('.'); const b = state.blocks.find(x => x.type === t); const d = b && TYPES[t].params.find(q => q.k === k); return b && d ? { b, d } : null; }).filter(Boolean);
  if (!targets.length) return null;
  const [first, ...rest] = targets, row = paramEl(first.b, { ...first.d, label: label || first.d.label });
  const ctl = row.matches('input,select') ? row : row.querySelector('input,select');
  const link = () => rest.forEach(t => { t.b.p[t.d.k] = t.d.t === 'range' ? Math.min(first.b.p[first.d.k], t.d.max) : first.b.p[first.d.k]; });
  if (ctl && rest.length) ['input', 'change'].forEach(ev => ctl.addEventListener(ev, link));
  return row;
}
function renderSimple() {
  const box = $('#simpleAdjust'); box.innerHTML = '';
  const l = LOOKS.find(x => x.name === state.preset), body = h('div', { class: 'body', style: 'padding-top:4px' });
  box.append(h('section', { class: 'card', style: '--bc:var(--accent)' }, h('header', {}, h('h2', {}, l ? `${l.name} — tweak` : 'Custom stack')), body));
  if (!l) body.append(h('p', { class: 'hint' }, 'This stack was built in Advanced mode. Pick a look above to start from a preset, or switch to Advanced to keep editing.'));
  else for (const [path, label] of l.knobs) { const el = knobEl(path, label); el && body.append(el); }
  const pb = state.blocks.find(b => b.p.palette);
  if (pb) body.append(h('div', { class: 'row' }, h('label', {}, 'Colors'), paletteEditor(pb, 'palette', { sync: pal => state.blocks.forEach(x => { if (x !== pb && x.p.palette) x.p.palette = pal.slice(); }) })));
  body.append(mixRow());
}
let thumbVer = -1;
async function buildThumbs() {
  if (!src || thumbVer === srcVer) return;
  const ver = thumbVer = srcVer, sc = Math.min(1, 600 / Math.max(src.width, src.height));
  const base = mk(Math.round(src.width * sc), Math.round(src.height * sc)), g = base.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, base.width, base.height);
  for (const l of LOOKS) {
    await new Promise(r => setTimeout(r, 30)); if (ver !== srcVer) return;
    const cv = await runChain(l.build(), base, base.width / src.width); if (ver !== srcVer) return;
    cards[l.name].th.replaceChildren(cv);
  }
}
function applyMode() {
  const simple = state.mode === 'simple';
  $('#simple').hidden = !simple; $('#advanced').hidden = simple; $('#mixHost').hidden = simple;
  $('#modeSimple').setAttribute('aria-pressed', simple); $('#modeAdv').setAttribute('aria-pressed', !simple);
  if (simple) { renderSimple(); buildThumbs(); } markSelected();
}
const setMode = m => { state.mode = m; applyMode(); saveSettings(); };
$('#modeSimple').addEventListener('click', () => setMode('simple'));
$('#modeAdv').addEventListener('click', () => setMode('advanced'));
$('#maxDim').addEventListener('change', e => { state.maxDim = Number(e.target.value); buildSrc(); touch(); });
$('#btnReset').addEventListener('click', () => { if (!confirm('Reset the modifier stack to the default?')) return; const m = state.mode; state = DEFAULTS(); state.mode = m; syncAll(); touch(); });
function syncAll() { $('#maxDim').value = state.maxDim; renderBlocks(); $('#mixHost').replaceChildren(mixRow()); buildSrc(); applyMode(); }

const cmp = $('#btnCompare'), showOrig = on => { origCv.hidden = !on; };
cmp.addEventListener('pointerdown', e => { e.preventDefault(); showOrig(true); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => cmp.addEventListener(ev, () => showOrig(false)));
cmp.addEventListener('contextmenu', e => e.preventDefault());

let looks = [];
function drawLooks() {
  const ul = $('#looks'); ul.innerHTML = '';
  looks.forEach((l, i) => ul.append(h('li', {}, h('span', {}, l.name),
    h('button', { class: 'btn small', onclick: () => { const s = sanitize(l.settings); if (!s) return; s.mode = state.mode; state = s; syncAll(); touch(); } }, 'Load'),
    h('button', { class: 'ib', 'aria-label': 'Delete', onclick: () => { looks.splice(i, 1); kvSet('looks', looks); drawLooks(); } }, '✕'))));
}
$('#btnSaveLook').addEventListener('click', () => {
  const name = prompt('Name this look:', `Look ${looks.length + 1}`); if (!name) return;
  looks.push({ name, settings: JSON.parse(JSON.stringify(state)) }); kvSet('looks', looks); drawLooks();
});

const fileInput = $('#file');
$('#btnOpen').addEventListener('click', () => fileInput.click());
$('#drop').addEventListener('click', e => { if (e.target.id !== 'btnSample') fileInput.click(); });
$('#btnSample').addEventListener('click', async () => loadBlob(await makeSample(), 'sample'));
fileInput.addEventListener('change', () => { const f = fileInput.files[0]; if (f) loadBlob(f, f.name); fileInput.value = ''; });
const stage = $('#stage');
['dragenter', 'dragover'].forEach(ev => stage.addEventListener(ev, e => { e.preventDefault(); $('#drop').classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => stage.addEventListener(ev, e => { e.preventDefault(); $('#drop').classList.remove('over'); }));
stage.addEventListener('drop', e => { const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/')); if (f) loadBlob(f, f.name); });
document.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/')); if (f) loadBlob(f, 'pasted'); });
/* ---- save / share ---- */
const MIME = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
async function exportImage(share) {
  const b = await new Promise(r => out.toBlob(r, MIME[state.fmt], state.q / 100));
  if (!b) { alert('Could not export the image.'); return; }
  const name = `${srcName}-styled.${{ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[b.type] || 'png'}`;
  if (share) { try { await navigator.share({ files: [new File([b], name, { type: b.type })], title: 'Styled image' }); } catch (e) {} return; }
  const a = h('a', { href: URL.createObjectURL(b), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('#btnSave').addEventListener('click', () => {
  const fmt = h('select', {}, [['png', 'PNG (lossless)'], ['jpeg', 'JPEG (smaller)'], ['webp', 'WebP (smaller)']].map(([v, l]) => h('option', { value: v }, l))); fmt.value = state.fmt;
  const qo = h('output', {}, state.q), q = h('input', { type: 'range', min: 40, max: 100, step: 1 }); q.value = state.q;
  const qrow = h('div', { class: 'row' }, h('label', {}, 'Quality', qo), q), sync = () => { qrow.hidden = fmt.value === 'png'; };
  fmt.addEventListener('change', () => { state.fmt = fmt.value; sync(); saveSettings(); });
  q.addEventListener('input', () => { state.q = Number(q.value); qo.textContent = q.value; saveSettings(); });
  sync();
  const canShare = navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] });
  openSheet('Save image', h('div', { class: 'row', style: 'gap:14px' }, h('div', { class: 'row' }, h('label', {}, 'Format'), fmt), qrow,
    h('div', { class: 'row inline' }, h('button', { class: 'btn primary', style: 'flex:1', onclick: () => { exportImage(false); closeSheet(); } }, 'Download'),
      canShare ? h('button', { class: 'btn', style: 'flex:1', onclick: () => { closeSheet(); exportImage(true); } }, 'Share…') : null)));
});

/* ---- undo / redo ---- */
let hist = [], hi = -1, histTimer, restoring = false;
const snap = () => JSON.stringify({ ...state, fmt: '', q: 0, mode: '' }, (k, v) => k === 'id' ? undefined : v);
function updUndo() { $('#btnUndo').disabled = hi <= 0; $('#btnRedo').disabled = hi >= hist.length - 1; }
function commitHist() { clearTimeout(histTimer); const j = snap(); if (j === hist[hi]) return; hist = hist.slice(0, hi + 1); hist.push(j); if (hist.length > 60) hist.shift(); hi = hist.length - 1; updUndo(); }
function pushHist() { if (restoring) return; clearTimeout(histTimer); histTimer = setTimeout(commitHist, 450); }
function goHist(d) {
  commitHist(); const t = hi + d; if (t < 0 || t >= hist.length) return; hi = t;
  restoring = true; const prev = state, s = sanitize(JSON.parse(hist[hi])); if (!s) { restoring = false; return; }
  s.mode = prev.mode; s.fmt = prev.fmt; s.q = prev.q; state = s;
  renderBlocks(); $('#mixHost').replaceChildren(mixRow()); $('#maxDim').value = state.maxDim; markSelected();
  if (prev.maxDim !== s.maxDim || prev.rot !== s.rot || prev.flip !== s.flip) { buildSrc(); } 
  if (state.mode === 'simple') { renderSimple(); buildThumbs(); }
  schedule(); saveSettings(); restoring = false; updUndo();
}
$('#btnUndo').addEventListener('click', () => goHist(-1));
$('#btnRedo').addEventListener('click', () => goHist(1));
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.target.matches('input[type=text],input:not([type]),textarea')) return;
  const k = e.key.toLowerCase();
  if (k === 'z') { e.preventDefault(); goHist(e.shiftKey ? 1 : -1); } else if (k === 'y') { e.preventDefault(); goHist(1); }
});

/* ---- rotate / flip ---- */
const reSrc = () => { buildSrc(); saveSettings(); schedule(); if (state.mode === 'simple') buildThumbs(); };
$('#btnRotate').addEventListener('click', () => { state.rot = (state.rot + 90) % 360; reSrc(); });
$('#btnFlip').addEventListener('click', () => { state.flip = !state.flip; reSrc(); });

/* ---- install + offline ---- */
let deferredInstall = null;
function showInstall() {
  const row = $('#installRow'); row.replaceChildren();
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) { row.hidden = true; return; }
  if (deferredInstall) row.append(h('button', { class: 'btn small', onclick: async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; showInstall(); } }, 'Install app'), h('span', { class: 'hint' }, 'Adds it to your home screen.'));
  else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) row.append(h('span', { class: 'hint' }, 'To install: tap Share, then “Add to Home Screen”.'));
  row.hidden = !row.childNodes.length;
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; showInstall(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; showInstall(); });
showInstall();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => { $('#pwaHint').textContent = '✓ Ready to work offline.'; }).catch(() => {});
}


/* ================= boot ================= */
(async () => {
  const saved = sanitize(await kvGet('stack')); if (saved) state = saved;
  syncAll(); hist = [snap()]; hi = 0; updUndo();
  looks = (await kvGet('looks')) || []; drawLooks();
  const img = await kvGet('image'); if (img && img.blob) loadBlob(img.blob, img.name, false);
})();
})();
