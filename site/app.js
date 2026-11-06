(() => {
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hslToHex(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/* ---------- palettes & defaults ---------- */
const PRESETS = {
  'Sunset': ['#1b1035', '#5b2a86', '#c13584', '#ff5e6c', '#ff9a5a', '#ffe7a3'],
  'Game Boy': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  'Noir': ['#000000', '#3a3a3a', '#8a8a8a', '#d9d9d9', '#ffffff'],
  'Neon': ['#0b0021', '#2d00f7', '#8900f2', '#f20089', '#00f5d4', '#fff75e'],
  'Pastel': ['#2b2d42', '#8d99ae', '#cdb4db', '#ffafcc', '#bde0fe', '#fdf6e3'],
  'CGA': ['#000000', '#55ffff', '#ff55ff', '#ffffff'],
  'Forest': ['#0b1d16', '#1f4d3a', '#3f7d4e', '#9bc268', '#f1e9b8'],
  'Rust': ['#1a0f0a', '#4a2511', '#8c4a1f', '#d98a3d', '#f4d58d', '#fff8e7'],
  'Ice': ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8', '#ffffff'],
  'Rainbow 16': Array.from({ length: 16 }, (_, i) => hslToHex(i * 22.5, .85, .55)),
};
const DEFAULTS = () => ({
  maxDim: 1200,
  palette: PRESETS['Sunset'].slice(),
  posterize: { on: true },
  noise: { on: true, amount: 30, size: 1, mono: true, seed: 1 },
  pixel: { on: true, size: 4, compress: true, quality: 30, passes: 2 },
  dither: { on: true, method: 'cross', strength: 70, scale: 2 },
});
let state = DEFAULTS();

const getPath = (o, p) => p.split('.').reduce((a, k) => a[k], o);
const setPath = (o, p, v) => { const ks = p.split('.'), l = ks.pop(); ks.reduce((a, k) => a[k], o)[l] = v; };
function merge(base, extra) {
  if (!extra || typeof extra !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (!(k in extra)) continue;
    if (Array.isArray(base[k])) { if (Array.isArray(extra[k]) && extra[k].length >= 3 && extra[k].length <= 16) base[k] = extra[k].slice(); }
    else if (base[k] && typeof base[k] === 'object') merge(base[k], extra[k]);
    else if (typeof extra[k] === typeof base[k]) base[k] = extra[k];
  }
  return base;
}

/* ---------- persistent storage (IndexedDB) ---------- */
const dbp = (() => {
  try {
    return new Promise((res, rej) => {
      const r = indexedDB.open('image-styler', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  } catch (e) { return Promise.reject(e); }
})();
dbp.catch(() => { $('#storeHint').textContent = 'Storage unavailable in this browser mode — changes will not be remembered.'; });
const kv = (mode, fn) => dbp.then(db => new Promise((res, rej) => {
  const q = fn(db.transaction('kv', mode).objectStore('kv'));
  q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
}));
const kvGet = k => kv('readonly', s => s.get(k)).catch(() => undefined);
const kvSet = (k, v) => kv('readwrite', s => s.put(v, k)).catch(() => {});
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

let saveTimer;
const saveSettings = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => kvSet('settings', state), 300); };

/* ---------- image source ---------- */
let srcBitmap = null;   // full-res decoded image
let srcName = 'image';
let src = null;         // canvas, downscaled to maxDim

async function loadBlob(blob, name, persist = true) {
  let bmp;
  try { bmp = await createImageBitmap(blob); }
  catch (e) { alert('Could not read that image.'); return; }
  srcBitmap = bmp; srcName = (name || 'image').replace(/\.[^.]+$/, '');
  if (persist) kvSet('image', { blob, name: srcName });
  buildSrc();
  $('#drop').hidden = true; $('#canvasWrap').hidden = false;
  $('#btnDownload').disabled = false;
  schedule();
}
function buildSrc() {
  if (!srcBitmap) return;
  const m = Math.max(srcBitmap.width, srcBitmap.height), sc = Math.min(1, state.maxDim / m);
  const w = Math.max(1, Math.round(srcBitmap.width * sc)), h = Math.max(1, Math.round(srcBitmap.height * sc));
  src = document.createElement('canvas'); src.width = w; src.height = h;
  const c = src.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(srcBitmap, 0, 0, w, h);
}
function makeSample() {
  const c = document.createElement('canvas'); c.width = 900; c.height = 600;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 600);
  sky.addColorStop(0, '#1a1a4e'); sky.addColorStop(.5, '#d6457a'); sky.addColorStop(1, '#ffc27a');
  g.fillStyle = sky; g.fillRect(0, 0, 900, 600);
  const sun = g.createRadialGradient(450, 330, 10, 450, 330, 190);
  sun.addColorStop(0, '#fffbe0'); sun.addColorStop(.4, '#ffd36e'); sun.addColorStop(1, 'rgba(255,150,80,0)');
  g.fillStyle = sun; g.beginPath(); g.arc(450, 330, 190, 0, 7); g.fill();
  g.fillStyle = '#1b1530';
  g.beginPath(); g.moveTo(0, 600); g.lineTo(0, 440);
  for (let x = 0; x <= 900; x += 30) g.lineTo(x, 430 - 60 * Math.abs(Math.sin(x / 140)) - 30 * Math.sin(x / 47));
  g.lineTo(900, 600); g.fill();
  g.fillStyle = '#0c0a18'; g.fillRect(0, 520, 900, 80);
  return new Promise(r => c.toBlob(r, 'image/png'));
}

/* ---------- effects ---------- */
function paletteRgb() { return state.palette.map(hexToRgb); }
function nearest(pal, r, g, b) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < pal.length; i++) {
    const p = pal[i], dr = r - p[0], dg = g - p[1], db = b - p[2], d = dr * dr + dg * dg + db * db;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function posterize(data, pal) {
  for (let i = 0; i < data.length; i += 4) {
    const p = pal[nearest(pal, data[i], data[i + 1], data[i + 2])];
    data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2];
  }
}
function addNoise(id, o) {
  const { width: w, height: h, data } = id, rnd = mulberry32(o.seed), amp = o.amount / 100 * 255, s = o.size;
  const gw = Math.ceil(w / s), gh = Math.ceil(h / s), ch = o.mono ? 1 : 3;
  const grid = new Float32Array(gw * gh * ch);
  for (let i = 0; i < grid.length; i++) grid[i] = (rnd() - .5) * 2 * amp;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gi = ((y / s | 0) * gw + (x / s | 0)) * ch, i = (y * w + x) * 4;
    data[i] = clamp(data[i] + grid[gi], 0, 255);
    data[i + 1] = clamp(data[i + 1] + grid[ch === 1 ? gi : gi + 1], 0, 255);
    data[i + 2] = clamp(data[i + 2] + grid[ch === 1 ? gi : gi + 2], 0, 255);
  }
}
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
async function jpegPass(c, q) {
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
  if (!blob) return;
  const bmp = await createImageBitmap(blob), g = c.getContext('2d');
  g.drawImage(bmp, 0, 0); bmp.close && bmp.close();
}
async function pixelate(cv, o) {
  const W = cv.width, H = cv.height, s = o.size;
  const sw = Math.max(1, Math.ceil(W / s)), sh = Math.max(1, Math.ceil(H / s));
  let small = cv;
  if (s > 1) {
    small = mk(sw, sh);
    const g = small.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(cv, 0, 0, W, H, 0, 0, sw, sh);
  }
  if (o.compress) {
    // JPEG has no alpha: flatten to opaque first (all our pixels are opaque already)
    for (let i = 0; i < o.passes; i++) await jpegPass(small, o.quality / 100);
  }
  if (s > 1) {
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, sw, sh, 0, 0, sw * s, sh * s);
  }
}

// threshold matrices, values in [0,1)
function bayer(n) {
  let m = [[0]];
  while (m.length < n) {
    const k = m.length, r = Array.from({ length: k * 2 }, () => new Array(k * 2));
    for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) {
      const v = m[y][x] * 4;
      r[y][x] = v; r[y][x + k] = v + 2; r[y + k][x] = v + 3; r[y + k][x + k] = v + 1;
    }
    m = r;
  }
  return { n, v: m.flat().map(v => (v + .5) / (n * n)) };
}
const B4 = bayer(4), B8 = bayer(8);
const CROSS = (() => { // diagonal cross-hatch lines with a Bayer tie-break
  const n = 8, v = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = (x + y) % n, b = (x - y + n) % n;
    const d = Math.min(Math.min(a, n - a), Math.min(b, n - b)); // 0..2
    v.push((d + B8.v[y * n + x]) / 3);
  }
  return { n, v };
})();

function ditherData(id, pal, o) {
  const { width: w, height: h, data } = id, str = o.strength / 100;
  if (o.method === 'floyd' || o.method === 'atkinson') {
    const buf = new Float32Array(w * h * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) { buf[j] = data[i]; buf[j + 1] = data[i + 1]; buf[j + 2] = data[i + 2]; }
    const fs = o.method === 'floyd';
    const taps = fs ? [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]]
                    : [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 3, r = clamp(buf[j], 0, 255), g = clamp(buf[j + 1], 0, 255), b = clamp(buf[j + 2], 0, 255);
      const p = pal[nearest(pal, r, g, b)], er = (r - p[0]) * str, eg = (g - p[1]) * str, eb = (b - p[2]) * str;
      const i = (y * w + x) * 4; data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2];
      for (const [dx, dy, wt] of taps) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= w || ny >= h) continue;
        const k = (ny * w + nx) * 3; buf[k] += er * wt; buf[k + 1] += eg * wt; buf[k + 2] += eb * wt;
      }
    }
    return;
  }
  const m = o.method === 'bayer4' ? B4 : o.method === 'bayer8' ? B8 : CROSS;
  const spread = str * 200;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, t = (m.v[(y % m.n) * m.n + (x % m.n)] - .5) * spread;
    const p = pal[nearest(pal, data[i] + t, data[i + 1] + t, data[i + 2] + t)];
    data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2];
  }
}
function dither(cv, pal, o) {
  const s = o.scale, W = cv.width, H = cv.height;
  const sw = Math.max(1, Math.ceil(W / s)), sh = Math.max(1, Math.ceil(H / s));
  let t = cv;
  if (s > 1) { t = mk(sw, sh); const g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, W, H, 0, 0, sw, sh); }
  const g = t.getContext('2d'), id = g.getImageData(0, 0, t.width, t.height);
  ditherData(id, pal, o); g.putImageData(id, 0, 0);
  if (s > 1) { const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(t, 0, 0, sw, sh, 0, 0, sw * s, sh * s); }
}

/* ---------- render pipeline ---------- */
const out = $('#out'), origCv = $('#orig'), octx = out.getContext('2d');
let token = 0, raf = 0;
function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }
async function render() {
  if (!src) return;
  const tok = ++token, W = src.width, H = src.height, pal = paletteRgb();
  const work = mk(W, H), g = work.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  if (state.posterize.on || state.noise.on) {
    const id = g.getImageData(0, 0, W, H);
    if (state.posterize.on) posterize(id.data, pal);
    if (state.noise.on && state.noise.amount > 0) addNoise(id, state.noise);
    g.putImageData(id, 0, 0);
  }
  if (state.pixel.on) { await pixelate(work, state.pixel); if (tok !== token) return; }
  if (state.dither.on) dither(work, pal, state.dither);
  if (tok !== token) return;
  out.width = W; out.height = H; octx.drawImage(work, 0, 0);
  origCv.width = W; origCv.height = H; origCv.getContext('2d').drawImage(src, 0, 0);
  $('#info').textContent = `${W} × ${H}px`;
  fitClass();
}
function fitClass() { out.classList.toggle('pix', out.clientWidth > out.width); origCv.className = out.className; }
window.addEventListener('resize', () => src && fitClass());

/* ---------- UI binding ---------- */
function syncUI() {
  $$('[data-k]').forEach(el => {
    const v = getPath(state, el.dataset.k);
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  });
  $$('[data-o]').forEach(o => o.value = getPath(state, o.dataset.o));
  $('#pcount').value = state.palette.length; $('#pcountOut').value = state.palette.length;
  drawSwatches();
  $('#presets').value = Object.keys(PRESETS).find(k => PRESETS[k].join() === state.palette.join()) || '';
}
function onChange(e) {
  const el = e.target, k = el.dataset.k; if (!k) return;
  let v = el.type === 'checkbox' ? el.checked : el.type === 'range' || k === 'maxDim' ? Number(el.value) : el.value;
  setPath(state, k, v);
  const o = $(`[data-o="${k}"]`); if (o) o.value = v;
  if (k === 'maxDim') buildSrc();
  saveSettings(); schedule();
}
document.addEventListener('input', onChange);
document.addEventListener('change', onChange);

function drawSwatches() {
  const box = $('#swatches'); box.innerHTML = '';
  state.palette.forEach((c, i) => {
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = c; inp.title = c;
    inp.addEventListener('input', () => { state.palette[i] = inp.value; $('#presets').value = ''; saveSettings(); schedule(); });
    box.appendChild(inp);
  });
}
function setPalette(p) { state.palette = p.slice(0, 16); syncUI(); saveSettings(); schedule(); }

$('#pcount').addEventListener('input', e => {
  const n = Number(e.target.value), p = state.palette.slice(0, n), rnd = mulberry32(n * 7919 + p.length);
  while (p.length < n) p.push(hslToHex(rnd() * 360, .6 + rnd() * .3, .3 + rnd() * .4));
  setPalette(p);
});
const presetSel = $('#presets');
presetSel.innerHTML = '<option value="" disabled>Presets…</option>' + Object.keys(PRESETS).map(k => `<option>${k}</option>`).join('');
presetSel.addEventListener('change', () => PRESETS[presetSel.value] && setPalette(PRESETS[presetSel.value]));
$('#btnRandom').addEventListener('click', () => {
  const n = state.palette.length, rnd = mulberry32(Date.now() & 0xffff), h0 = rnd() * 360, p = [];
  for (let i = 0; i < n; i++) p.push(hslToHex((h0 + i * (360 / n) * (.4 + rnd() * .6)) % 360, .5 + rnd() * .4, .1 + .8 * i / (n - 1)));
  setPalette(p);
});
$('#btnExtract').addEventListener('click', () => {
  if (!src) return;
  const k = state.palette.length, g = src.getContext('2d'), d = g.getImageData(0, 0, src.width, src.height).data;
  const step = Math.max(1, Math.floor(d.length / 4 / 20000)), pts = [];
  for (let i = 0; i < d.length / 4; i += step) pts.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
  const rnd = mulberry32(5), cen = [pts[(rnd() * pts.length) | 0]];
  while (cen.length < k) { // k-means++ seeding
    const ds = pts.map(p => Math.min(...cen.map(c => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)));
    let r = rnd() * ds.reduce((a, b) => a + b, 0), j = 0; while (j < ds.length - 1 && (r -= ds[j]) > 0) j++;
    cen.push(pts[j]);
  }
  for (let it = 0; it < 10; it++) {
    const sum = cen.map(() => [0, 0, 0, 0]);
    for (const p of pts) { const s = sum[nearest(cen, p[0], p[1], p[2])]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; }
    sum.forEach((s, i) => { if (s[3]) cen[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  cen.sort((a, b) => (a[0] * .3 + a[1] * .59 + a[2] * .11) - (b[0] * .3 + b[1] * .59 + b[2] * .11));
  setPalette(cen.map(c => rgbToHex(...c)));
});
$('#btnReseed').addEventListener('click', () => { state.noise.seed = (Math.random() * 1e9) | 0; saveSettings(); schedule(); });
$('#btnReset').addEventListener('click', () => { state = DEFAULTS(); buildSrc(); syncUI(); saveSettings(); schedule(); });

/* compare (hold) */
const cmp = $('#btnCompare');
const showOrig = on => { origCv.hidden = !on; };
['pointerdown'].forEach(ev => cmp.addEventListener(ev, e => { e.preventDefault(); showOrig(true); }));
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => cmp.addEventListener(ev, () => showOrig(false)));

/* saved looks */
let looks = [];
function drawLooks() {
  const ul = $('#looks'); ul.innerHTML = '';
  looks.forEach((l, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<span></span><button class="btn small">Load</button><button class="btn small" aria-label="Delete">✕</button>';
    $('span', li).textContent = l.name;
    const [load, del] = $$('button', li);
    load.onclick = () => { state = merge(DEFAULTS(), JSON.parse(JSON.stringify(l.settings))); buildSrc(); syncUI(); saveSettings(); schedule(); };
    del.onclick = () => { looks.splice(i, 1); kvSet('looks', looks); drawLooks(); };
    ul.appendChild(li);
  });
}
$('#btnSaveLook').addEventListener('click', () => {
  const name = prompt('Name this look:', `Look ${looks.length + 1}`); if (!name) return;
  looks.push({ name, settings: JSON.parse(JSON.stringify(state)) }); kvSet('looks', looks); drawLooks();
});

/* upload / drop / paste / download */
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
$('#btnDownload').addEventListener('click', () => {
  out.toBlob(b => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${srcName}-styled.png`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
});

/* ---------- boot: restore saved session ---------- */
(async () => {
  const saved = await kvGet('settings');
  if (saved) state = merge(DEFAULTS(), saved);
  syncUI();
  looks = (await kvGet('looks')) || []; drawLooks();
  const img = await kvGet('image');
  if (img && img.blob) loadBlob(img.blob, img.name, false);
})();
})();
