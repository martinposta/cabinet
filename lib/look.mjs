// Looks (PLAN D6): an optional colour treatment applied at import. A look is either a preset from
// data/looks.json (a few knobs, see below) or "lut:<file>.cube" from assets-inbox/looks/. Everything
// runs on raw RGBA pixels in JS – no extra dependency – and alpha passes through untouched.
//
// Preset knobs (all optional, neutral when missing):
//   exposure  -1..1   brighten/darken (multiplier 2^exposure)
//   contrast  0.5..2  around mid grey
//   lift      0..0.3  raises the blacks (faded print)
//   saturation 0..2
//   warmth    -1..1   + = amber, − = blue
//   gamma     0.5..2  > 1 darkens the mids
//   vignette  0..1    darkens the edges
//   grain     0..1    film grain (seeded, so re-applying gives the same file)

import fs from 'node:fs/promises';
import path from 'node:path';
import { PATHS } from './config.mjs';

export const DEFAULT_LOOKS = [
  { id: 'night-oil', name: 'Noční olej', knobs: { exposure: -0.25, contrast: 1.08, saturation: 0.82, warmth: 0.25, gamma: 1.08, vignette: 0.35, grain: 0.15 } },
  { id: 'candlelit', name: 'Při svíčce', knobs: { exposure: -0.15, contrast: 1.05, saturation: 0.9, warmth: 0.55, vignette: 0.5, grain: 0.1 } },
  { id: 'faded-print', name: 'Vybledlý tisk', knobs: { contrast: 0.85, lift: 0.08, saturation: 0.6, warmth: 0.15, grain: 0.2 } },
  { id: 'cold-night', name: 'Studená noc', knobs: { exposure: -0.3, contrast: 1.1, saturation: 0.7, warmth: -0.35, vignette: 0.4 } },
];

export async function loadLooks() {
  try { return JSON.parse(await fs.readFile(PATHS.looks, 'utf8')); }
  catch (err) { if (err.code === 'ENOENT') return DEFAULT_LOOKS; throw err; }
}

export async function listLuts() {
  try { return (await fs.readdir(PATHS.luts)).filter(f => f.toLowerCase().endsWith('.cube')).sort(); }
  catch { return []; }
}

/** Every look the admin can offer: [{ id, name }]. */
export async function availableLooks() {
  return [...(await loadLooks()).map(l => ({ id: l.id, name: l.name })),
    ...(await listLuts()).map(f => ({ id: `lut:${f}`, name: `LUT: ${f}` }))];
}

// ---------- .cube ----------

/** Parses a 3D .cube LUT: { size, min:[r,g,b], max:[r,g,b], table: Float32Array (r fastest) }. */
export function parseCube(text) {
  let size = 0, min = [0, 0, 0], max = [1, 1, 1];
  const vals = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [key, ...rest] = line.split(/\s+/);
    if (key === 'LUT_3D_SIZE') size = Number(rest[0]);
    else if (key === 'LUT_1D_SIZE') throw new Error('1D LUT není podporovaný, exportuj 3D .cube');
    else if (key === 'DOMAIN_MIN') min = rest.map(Number);
    else if (key === 'DOMAIN_MAX') max = rest.map(Number);
    else if (/^[-+.\d]/.test(key)) vals.push(Number(key), Number(rest[0]), Number(rest[1]));
  }
  if (!(size >= 2 && size <= 256)) throw new Error('Soubor .cube nemá platné LUT_3D_SIZE');
  if (vals.length !== size ** 3 * 3 || vals.some(v => !Number.isFinite(v))) throw new Error(`Soubor .cube má ${vals.length / 3} řádků dat, čekám ${size ** 3}`);
  return { size, min, max, table: Float32Array.from(vals) };
}

function applyLut(px, channels, lut) {
  const { size: N, min, max, table: T } = lut;
  const s = N - 1, N2 = N * N;
  const sc = [0, 1, 2].map(c => s / ((max[c] - min[c]) * 255));
  for (let i = 0; i < px.length; i += channels) {
    const fr = Math.min(s, Math.max(0, (px[i] - min[0] * 255) * sc[0]));
    const fg = Math.min(s, Math.max(0, (px[i + 1] - min[1] * 255) * sc[1]));
    const fb = Math.min(s, Math.max(0, (px[i + 2] - min[2] * 255) * sc[2]));
    const r0 = Math.min(s - 1, fr | 0), g0 = Math.min(s - 1, fg | 0), b0 = Math.min(s - 1, fb | 0);
    const dr = fr - r0, dg = fg - g0, db = fb - b0;
    for (let c = 0; c < 3; c++) {
      const at = (r, g, b) => T[((b * N2) + (g * N) + r) * 3 + c];
      const c00 = at(r0, g0, b0) * (1 - dr) + at(r0 + 1, g0, b0) * dr;
      const c10 = at(r0, g0 + 1, b0) * (1 - dr) + at(r0 + 1, g0 + 1, b0) * dr;
      const c01 = at(r0, g0, b0 + 1) * (1 - dr) + at(r0 + 1, g0, b0 + 1) * dr;
      const c11 = at(r0, g0 + 1, b0 + 1) * (1 - dr) + at(r0 + 1, g0 + 1, b0 + 1) * dr;
      const v = (c00 * (1 - dg) + c10 * dg) * (1 - db) + (c01 * (1 - dg) + c11 * dg) * db;
      px[i + c] = Math.max(0, Math.min(255, Math.round(v * 255)));
    }
  }
}

// ---------- presets ----------

function applyKnobs(px, channels, w, h, k) {
  const gain = 2 ** (k.exposure ?? 0), con = k.contrast ?? 1, lift = (k.lift ?? 0) * 255;
  const sat = k.saturation ?? 1, warm = k.warmth ?? 0, gam = k.gamma ?? 1;
  const vig = k.vignette ?? 0, grain = (k.grain ?? 0) * 40;
  const wr = 1 + warm * 0.12, wg = 1 + warm * 0.02, wb = 1 - warm * 0.14;
  // tone curve as a 256-entry table: exposure → contrast → gamma → lift
  const curve = new Float32Array(256);
  for (let v = 0; v < 256; v++) {
    let x = Math.min(1, v / 255 * gain);
    x = (x - 0.5) * con + 0.5;
    x = Math.max(0, Math.min(1, x)) ** gam;
    curve[v] = lift + x * (255 - lift);
  }
  const cx = w / 2, cy = h / 2, rmax = Math.hypot(cx, cy);
  let seed = 0x9e3779b9;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += channels) {
      let r = curve[px[i]], g = curve[px[i + 1]], b = curve[px[i + 2]];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
      r *= wr; g *= wg; b *= wb;
      if (vig) { const d = Math.hypot(x - cx, y - cy) / rmax; const f = 1 - vig * Math.max(0, (d - 0.35) / 0.65) ** 1.6; r *= f; g *= f; b *= f; }
      if (grain) { const n = (rnd() + rnd() - 1) * grain; r += n; g += n; b += n; }
      px[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      px[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      px[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  }
}

/**
 * Applies a look in place to raw pixels ({ data, info } from sharp().raw()). `look` = null | preset id | "lut:<file>".
 * Throws a readable error for an unknown look or a broken LUT.
 */
export async function applyLook(raw, look) {
  if (!look) return raw;
  const { width: w, height: h, channels } = raw.info;
  if (look.startsWith('lut:')) {
    const file = path.join(PATHS.luts, path.basename(look.slice(4)));
    let text;
    try { text = await fs.readFile(file, 'utf8'); } catch { throw new Error(`LUT ${path.basename(file)} není ve složce assets-inbox/looks`); }
    applyLut(raw.data, channels, parseCube(text));
    return raw;
  }
  const preset = (await loadLooks()).find(l => l.id === look);
  if (!preset) throw new Error(`Neznámý look: ${look}`);
  applyKnobs(raw.data, channels, w, h, preset.knobs || {});
  return raw;
}
