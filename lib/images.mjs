// Image pipeline (PLAN section 4): original → auto-orient → reduce to the kind's max → optional look
// → WebP widths (alpha kept) in docs/media/<id>/. Output never carries metadata (sharp strips it;
// never add keepMetadata/withMetadata – Fotogalerie invariant 2). A copy of the original stays in
// assets-inbox/_imported/ so a different look can be applied later (D6).

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { IMAGE, KINDS, PATHS } from './config.mjs';
import { applyLook } from './look.mjs';

export const hashBuffer = buf => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
export const mediaDir = id => path.join(PATHS.media, id);

// Ids being rendered or imported right now. A build running meanwhile must not prune their folders
// (they are not in the data yet), see lib/build.mjs.
export const pendingMedia = new Set();

/**
 * The hand candle as a real system cursor (drawn by the OS, so it never trails the mouse like a moved
 * image does): PNGs at 1× and 2× of `h` CSS px, cut from the largest derivative. Browsers refuse cursors
 * over 128 px, so null when the candle is taller or wider than that. Files carry the media version.
 */
export async function cursorFiles(id, m, h) {
  const w = Math.round(h * m.w / m.h);
  if (h > 128 || w > 128 || !m.widths?.length) return null;
  const src = path.join(mediaDir(id), `${m.widths[m.widths.length - 1]}.webp`), files = {};
  for (const k of [1, 2]) {
    const f = `cursor-${h}-v${m.v || 1}-${k}x.png`, p = path.join(mediaDir(id), f);
    try { await fs.access(p); } catch { await sharp(src).resize(w * k, h * k, { fit: 'fill' }).png().toFile(p); }
    files[k] = `media/${id}/${f}`;
  }
  return { w, h, x1: files[1], x2: files[2] };
}

/**
 * Quick previews of a media item (IMAGE.preview): `p<width>.webp` next to the derivatives, made from the
 * derivative it stands in for, so a new look or a re-render (which replaces the folder) remakes them.
 * Returns { fullWidth: previewWidth } for the widths that have one, or null.
 */
export async function ensurePreviews(id, m) {
  const P = IMAGE.preview;
  if (!P.kinds.includes(m.kind) || !m.widths?.length) return null;
  const out = {};
  for (const w of m.widths) {
    if (w < P.minWidth) continue;
    const pw = Math.round(w / P.ratio), f = path.join(mediaDir(id), `p${pw}.webp`);
    try { await fs.access(f); }
    catch {
      let p = sharp(path.join(mediaDir(id), `${w}.webp`)).resize({ width: pw });
      if (!m.alpha) p = p.removeAlpha();
      await p.webp({ quality: P.quality, alphaQuality: P.alphaQuality, effort: 5, smartSubsample: true }).toFile(f);
    }
    out[w] = pw;
  }
  return Object.keys(out).length ? out : null;
}

/** Widths to generate for an image `w` px wide (the largest is the image itself, capped by kind.max). */
export function targetWidths(kind, w) {
  const top = Math.min(w, KINDS[kind].max);
  const ws = KINDS[kind].widths.filter(x => x < top * 0.85);
  ws.push(top);
  return [...new Set(ws)].sort((a, b) => a - b);
}

/** Decodes, orients and reduces an original to the kind's max long edge: raw RGBA + whether alpha matters. */
async function prepare(buf, kind) {
  const max = KINDS[kind].max;
  const img = sharp(buf, { failOn: 'none', limitInputPixels: IMAGE.maxInputPixels }).rotate();
  const meta = await sharp(buf, { failOn: 'none' }).metadata();
  const raw = await img
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // An image "has alpha" only if some pixel is not fully opaque; a PNG saved with an empty alpha
  // channel should not be treated as a cut-out.
  let alpha = false;
  if (meta.hasAlpha) for (let i = 3; i < raw.data.length; i += 4) if (raw.data[i] < 255) { alpha = true; break; }
  return { raw, alpha, source: { w: meta.autoOrient?.width ?? meta.width, h: meta.autoOrient?.height ?? meta.height } };
}

const fromRaw = ({ data, info }) => sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });

/** Average colour of the opaque pixels, as #rrggbb (placeholder while an image loads). */
function averageColor({ data }) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 16) if (data[i + 3] > 127) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  if (!n) return '#000000';
  return '#' + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('');
}

/**
 * Writes all derivatives of one media item and returns its record (without kind/name/v, which the caller owns).
 * Files are written to .media-tmp/<id> first and swapped in only on success, so a failed re-render keeps the old files.
 */
export async function renderMedia(buf, id, kind, look) {
  if (!KINDS[kind]) throw new Error(`Neznámý druh obrázku: ${kind}`);
  const { raw, alpha, source } = await prepare(buf, kind);
  await applyLook(raw, look);
  const W = raw.info.width, H = raw.info.height;
  const tmp = path.join(PATHS.mediaTmp, id);
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp, { recursive: true });
  const base = fromRaw(raw);
  const widths = targetWidths(kind, W);
  let bytes = 0;
  for (const w of widths) {
    let p = base.clone().resize({ width: w, withoutEnlargement: true });
    if (!alpha) p = p.removeAlpha();
    const res = await p.webp({ quality: IMAGE.quality, alphaQuality: IMAGE.alphaQuality, effort: 5, smartSubsample: true })
      .toFile(path.join(tmp, `${w}.webp`));
    bytes += res.size;
  }
  if (KINDS[kind].og) {
    const res = await base.clone().flatten({ background: '#0a1a12' })
      .resize({ width: IMAGE.og.width, height: IMAGE.og.width, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: IMAGE.og.quality, mozjpeg: true }).toFile(path.join(tmp, 'og.jpg'));
    bytes += res.size;
  }
  await fs.rm(mediaDir(id), { recursive: true, force: true });
  await fs.mkdir(PATHS.media, { recursive: true });
  await fs.rename(tmp, mediaDir(id));
  return { w: W, h: H, alpha, widths, look: look || null, color: averageColor(raw), bytes, source };
}

/** A small JPEG of the image with a look applied, for the admin's before/after preview. */
export async function previewLook(buf, look, width = 900) {
  const raw = await sharp(buf, { failOn: 'none', limitInputPixels: IMAGE.maxInputPixels }).rotate()
    .resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  await applyLook(raw, look);
  // checkerboard-free: cut-outs are shown on the wall colour so the edges can be judged
  return fromRaw(raw).flatten({ background: '#163126' }).jpeg({ quality: 82 }).toBuffer();
}

// ---------- originals ----------

export async function saveOriginal(buf, id, name) {
  await fs.mkdir(PATHS.originals, { recursive: true });
  const ext = (path.extname(name || '').toLowerCase() || '.bin').replace(/[^.a-z0-9]/g, '');
  await fs.writeFile(path.join(PATHS.originals, id + ext), buf);
}

export async function readOriginal(id) {
  let files = [];
  try { files = await fs.readdir(PATHS.originals); } catch {}
  const f = files.find(n => n.startsWith(id + '.'));
  if (!f) return null;
  return fs.readFile(path.join(PATHS.originals, f));
}

/** Deletes a media item's derivatives and its kept original; `keepDerivatives` only drops the original. */
export async function removeMediaFiles(id, { keepDerivatives = false } = {}) {
  if (!keepDerivatives) await fs.rm(mediaDir(id), { recursive: true, force: true });
  let files = [];
  try { files = await fs.readdir(PATHS.originals); } catch {}
  for (const f of files.filter(n => n.startsWith(id + '.'))) await fs.rm(path.join(PATHS.originals, f), { force: true });
}
