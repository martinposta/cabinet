// All mutations of data/cabinet.json. UserError = 400 with a Czech message for the admin.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { IMAGE, KINDS } from './config.mjs';
import { loadData, saveData } from './store.mjs';
import { hashBuffer, renderMedia, saveOriginal, readOriginal, removeMediaFiles, pendingMedia, mediaDir } from './images.mjs';
import { availableLooks } from './look.mjs';
import { FX, effects, FONTS, plates, surround } from './build.mjs';

export class UserError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/**
 * A fingerprint of the layout. The wall editor sends the one it started from with every save; if the
 * data changed meanwhile (another tab, a forgotten tab from an earlier session, the admin's table),
 * the save is refused instead of silently writing an old copy over the new one.
 */
export const layoutRev = data => crypto.createHash('sha1').update(JSON.stringify({ items: data.items, nameplate: data.nameplate, view: data.view ?? null, room: data.room ?? null })).digest('hex').slice(0, 16);

// dp: decimals kept – 2 for world px, 4 for fractions of an image (0.01 of a 1500 px picture is 15 px)
const num = (v, label, { min = -1e6, max = 1e6, dp = 2 } = {}) => {
  const n = Number(v);
  if (v === '' || v == null || !Number.isFinite(n) || n < min || n > max) throw new UserError(`${label}: čekám číslo mezi ${min} a ${max}`);
  const k = 10 ** dp;
  return Math.round(n * k) / k;
};
const text = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function checkLook(look) {
  if (!look) return null;
  if (!(await availableLooks()).some(l => l.id === look)) throw new UserError(`Neznámý look: ${look}`);
  return look;
}

function media(data, id) {
  const m = data.media[id];
  if (!m) throw new UserError('Takový obrázek v knihovně není');
  return m;
}

/** Where a media item is used, as readable Czech strings (empty = unused). */
export function mediaRefs(data, id) {
  const out = [];
  for (const it of data.items) {
    if (it.media === id) out.push(it.off ? `exponát ve skladu ${it.exhibit?.title || it.id}` : `položka ${it.id}`);
    if (it.exhibit?.gallery?.includes(id)) out.push(`galerie exponátu ${it.exhibit.title || it.id}`);
  }
  if (data.wall.wallpaper === id) out.push('tapeta');
  if (data.wall.grime === id) out.push('špína přes stěnu');
  if (data.cabinet.body === id) out.push('korpus skříně');
  if (data.cabinet.tray === id) out.push('samet v šuplících');
  (data.cabinet.drawers || []).forEach((d, i) => { if (d.front === id) out.push(`čelo šuplíku ${i + 1}`); });
  if (data.doors?.closed === id) out.push('zavřené dveře');
  if (data.doors?.ajar === id) out.push('pootevřené dveře');
  if (data.doors?.sound === id) out.push('vrznutí dveří');
  if (data.doors?.frame === id) out.push('futra kolem dveří');
  if (data.handCandle?.media === id) out.push('svíčka místo kurzoru');
  if (data.plates?.nameplate?.media === id) out.push('jmenovka');
  if (data.plates?.plaque?.media === id) out.push('štítky pod exponáty');
  for (const k of ['sideTop', 'sideMid', 'cornice', 'wainscot']) if (data.surround?.[k] === id) out.push('obložení místnosti');
  return out;
}

// ---------- media ----------

export async function importMedia(buf, name, kind, look) {
  if (!KINDS[kind]) throw new UserError('Vyber, co je obrázek zač (druh)');
  if (!IMAGE.acceptedExt.includes(path.extname(name).toLowerCase())) throw new UserError(`Nepodporovaný formát (${path.extname(name) || '?'}). Podporované: ${IMAGE.acceptedExt.join(', ')}`);
  look = await checkLook(look);
  const data = await loadData();
  const id = hashBuffer(buf);
  if (data.media[id]) return { duplicate: true, id, media: data.media[id] };
  if (pendingMedia.has(id)) throw new UserError('Tenhle obrázek se už právě importuje');
  pendingMedia.add(id);
  let r;
  try {
    try { r = await renderMedia(buf, id, kind, look); }
    catch (err) { throw new UserError(`Obrázek se nepodařilo zpracovat: ${err.message}`); }
    await saveOriginal(buf, id, name);
    const { source: _, ...rec } = r;
    data.media[id] = { kind, name: text(name, 200), ...rec, v: 1, addedAt: new Date().toISOString() };
    await saveData();
  } finally { pendingMedia.delete(id); }
  const { source } = r;
  const min = KINDS[kind].min;
  const warning = Math.max(source.w, source.h) < min ? `Obrázek je malý (${source.w}×${source.h}); pro tenhle druh doporučuju aspoň ${min} px na delší straně.` : '';
  return { id, media: data.media[id], warning };
}

export async function relookMedia(id, look) {
  const data = await loadData();
  const m = media(data, id);
  if (m.kind === 'sound') throw new UserError('Zvuk nemá look');
  look = await checkLook(look);
  const buf = await readOriginal(id);
  if (!buf) throw new UserError('Originál už není ve složce assets-inbox/_imported, look nejde změnit');
  const { source: _, ...rec } = await renderMedia(buf, id, m.kind, look);
  Object.assign(m, rec, { v: (m.v || 1) + 1 });
  await saveData();
  return { id, media: m };
}

/**
 * Replaces a media item's file but keeps its id, so every place that uses it stays as it is (wall,
 * galleries, roles). The kind and look are kept; `v` goes up so no browser shows the old file.
 */
export async function replaceMedia(id, buf, name) {
  const data = await loadData();
  const m = media(data, id);
  const other = hashBuffer(buf);
  if (other !== id && data.media[other]) throw new UserError(`Tenhle soubor už v knihovně je (${data.media[other].name})`);
  if (m.kind === 'sound') {
    const ext = path.extname(name || '').toLowerCase();
    if (!IMAGE.soundExt[ext]) throw new UserError(`Nepodporovaný zvuk (${ext || '?'})`);
    if (buf.length > IMAGE.maxSound) throw new UserError('Zvuk je moc velký (strop 2 MB)');
    await fs.rm(mediaDir(id), { recursive: true, force: true });
    await fs.mkdir(mediaDir(id), { recursive: true });
    await fs.writeFile(path.join(mediaDir(id), 'sound' + ext), buf);
    Object.assign(m, { name: text(name, 200) || m.name, ext, type: IMAGE.soundExt[ext], bytes: buf.length, v: (m.v || 1) + 1 });
  } else {
    if (!IMAGE.acceptedExt.includes(path.extname(name || '').toLowerCase())) throw new UserError(`Nepodporovaný formát (${path.extname(name || '') || '?'})`);
    pendingMedia.add(id);
    try {
      let r;
      try { r = await renderMedia(buf, id, m.kind, m.look); }
      catch (err) { throw new UserError(`Obrázek se nepodařilo zpracovat: ${err.message}`); }
      const { source: _, ...rec } = r;
      await removeMediaFiles(id, { keepDerivatives: true });
      await saveOriginal(buf, id, name);
      Object.assign(m, rec, { name: text(name, 200) || m.name, v: (m.v || 1) + 1 });
    } finally { pendingMedia.delete(id); }
  }
  await saveData();
  return { id, media: m };
}

export async function updateMedia(id, patch) {
  const data = await loadData();
  const m = media(data, id);
  if ('light' in patch) {
    const l = patch.light;
    m.light = l ? { x: num(l.x, 'Plamen X', { min: 0, max: 1 }), y: num(l.y, 'Plamen Y', { min: 0, max: 1 }), radius: num(l.radius ?? 340, 'Dosah světla', { min: 40, max: 2000 }) } : undefined;
    if (!m.light) delete m.light;
  }
  // shelves drawn on a bookcase image (fractions of the image): their bottom edges are where things are
  // put down on the wall; every copy of the image has them
  if ('shelves' in patch) {
    const list = patch.shelves || [];
    if (!Array.isArray(list) || list.length > 80) throw new UserError('Police: nejvýš 80');
    const f = (v, l) => num(v, `Police ${l}`, { min: 0, max: 1, dp: 4 });
    m.shelves = list.map(s => ({ x: f(s.x, 'X'), y: f(s.y, 'Y'), w: f(s.w, 'šířka'), h: f(s.h, 'výška') }))
      .filter(s => s.w >= 0.01 && s.h >= 0.01 && s.x + s.w <= 1.001 && s.y + s.h <= 1.001);
    if (!m.shelves.length) delete m.shelves;
  }
  if ('name' in patch) m.name = text(patch.name, 200);
  await saveData();
  return { id, media: m };
}

export async function deleteMedia(id) {
  const data = await loadData();
  media(data, id);
  const refs = mediaRefs(data, id);
  if (refs.length) throw new UserError(`Obrázek se používá (${refs.join(', ')}). Nejdřív ho odeber odtamtud.`);
  delete data.media[id];
  await saveData();
  await removeMediaFiles(id);
  return { ok: true };
}

/** The door creak (D14): published as uploaded, no conversion. */
export async function importSound(buf, name) {
  const ext = path.extname(name || '').toLowerCase();
  const type = IMAGE.soundExt[ext];
  if (!type) throw new UserError(`Nepodporovaný zvuk (${ext || '?'}). Podporované: ${Object.keys(IMAGE.soundExt).join(', ')}; nejlíp .mp3`);
  if (buf.length > IMAGE.maxSound) throw new UserError(`Zvuk má ${(buf.length / 1048576).toFixed(1)} MB, čekám krátké vrznutí do 2 MB (exportuj .mp3)`);
  const data = await loadData();
  const id = hashBuffer(buf);
  if (data.media[id]) return { duplicate: true, id, media: data.media[id] };
  await fs.mkdir(mediaDir(id), { recursive: true });
  await fs.writeFile(path.join(mediaDir(id), 'sound' + ext), buf);
  data.media[id] = { kind: 'sound', name: text(name, 200), ext, type, bytes: buf.length, v: 1, addedAt: new Date().toISOString() };
  await saveData();
  const warning = ext === '.wav' && buf.length > 300 * 1024 ? 'WAV je zbytečně velký, .mp3 by měl zlomek.' : '';
  return { id, media: data.media[id], warning };
}

const URL_OK = /^https?:\/\/[^\s/]+(\/[^\s]*)?\/$/;
const HOST_OK = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
export async function updateSettings(p) {
  const data = await loadData();
  const s = data.settings;
  if ('plateTitle' in p) s.plateTitle = text(p.plateTitle, 60) || 'Cabinet of Curiosities';
  if ('plateSubtitle' in p) s.plateSubtitle = text(p.plateSubtitle, 80);
  if ('description' in p) s.description = text(p.description, 300);
  // who made the site and their other sites – written into every page for search engines (build.mjs)
  if ('authorName' in p) s.authorName = text(p.authorName, 80);
  if ('authorLinks' in p) {
    const list = (Array.isArray(p.authorLinks) ? p.authorLinks : String(p.authorLinks || '').split(/[\s,]+/)).map(v => text(v, 200)).filter(Boolean);
    const bad = list.find(v => !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v));
    if (bad) throw new UserError(`Další stránky: „${bad}“ není celá adresa (https://…)`);
    if (list.length > 8) throw new UserError('Další stránky: nejvýš 8');
    s.authorLinks = list;
  }
  if ('siteUrl' in p) {
    const v = text(p.siteUrl, 200);
    if (v && !URL_OK.test(v)) throw new UserError('Adresa webu: celá adresa končící lomítkem, např. https://cabinet.martinposta.com/');
    s.siteUrl = v;
  }
  if ('customDomain' in p) {
    const v = text(p.customDomain, 120).toLowerCase();
    if (v && !HOST_OK.test(v)) throw new UserError('Doména: jen název, např. cabinet.martinposta.com');
    s.customDomain = v;
  }
  if ('fx' in p) {
    const cur = effects(s);
    s.fx = Object.fromEntries(FX.map(k => [k, k in (p.fx || {}) ? !!p.fx[k] : cur[k]]));
    delete s.roomCandleShadows;
  }
  if ('noindex' in p) { if (p.noindex) s.noindex = true; else delete s.noindex; } // soft launch: keep search engines out
  if ('analyticsToken' in p) {
    const v = text(p.analyticsToken, 64);
    if (v && !/^[a-f0-9]{32}$/i.test(v)) throw new UserError('Token Cloudflare Web Analytics má 32 znaků 0–9 a a–f');
    s.analyticsToken = v;
  }
  await saveData();
  return { settings: s };
}

/** The hand candle (phase 6): an item-kind image, its flame's centre as fractions, its height on screen. */
export async function setHandCandle(p) {
  const data = await loadData();
  if (!p.media) { data.handCandle = null; await saveData(); return { handCandle: null }; }
  const m = media(data, p.media);
  if (m.kind !== 'item') throw new UserError(`Svíčka musí být obrázek druhu „${KINDS.item.label}“ (s průhledností)`);
  data.handCandle = { media: p.media, fx: num(p.fx ?? 0.5, 'Plamen X', { min: 0, max: 1 }), fy: num(p.fy ?? 0.15, 'Plamen Y', { min: 0, max: 1 }),
    height: num(p.height ?? 118, 'Výška svíčky', { min: 24, max: 400 }) };
  await saveData();
  return { handCandle: data.handCandle };
}

/**
 * Look of the nameplate and of the brass plaques under exhibits. Each part is merged field by field,
 * so the admin can send one changed value. media: a „plate“ image or null (the painted brass).
 */
/** The room's surround: images of kind „surround“ (or null), sizes in world px, on/off; field-wise merge. */
export async function setSurround(p) {
  const data = await loadData();
  const cur = surround(data);
  const img = v => {
    if (!v) return null;
    const m = media(data, v);
    if (m.kind !== 'surround') throw new UserError(`Sem patří obrázek druhu „${KINDS.surround.label}“`);
    return v;
  };
  const RULES = {
    on: v => !!v, sideTop: img, sideMid: img, cornice: img, wainscot: img,
    sideW: v => num(v, 'Šířka boku', { min: 40, max: 1200 }),
    corniceH: v => num(v, 'Výška římsy', { min: 20, max: 800 }),
    wainscotH: v => num(v, 'Výška lambrie', { min: 40, max: 1600 }),
  };
  for (const [k, v] of Object.entries(p || {})) {
    if (!RULES[k]) throw new UserError(`Neznámé nastavení obložení: ${k}`);
    cur[k] = RULES[k](v);
  }
  data.surround = cur;
  await saveData();
  return { surround: cur };
}

/** Where the doors sit inside the casing picture (fractions of it); null = the casing is not used yet. */
export async function setDoorsOpening(p) {
  const data = await loadData();
  data.doors ??= { closed: null, ajar: null, sound: null };
  // the copy of the notices board beside the casing: centre x/y and height in fractions of the portal box
  // (x may go past 1 – it hangs to the right of the casing); null = the default place (build.mjs)
  if ('noticesAt' in (p || {})) {
    const n = p.noticesAt;
    if (!n) delete data.doors.noticesAt;
    else {
      const f = (v, l, min, max) => num(v, `Tabule u dveří ${l}`, { min, max, dp: 4 });
      data.doors.noticesAt = { x: f(n.x, 'X', -1, 2), y: f(n.y, 'Y', 0, 1), h: f(n.h, 'výška', 0.05, 0.8) };
    }
    if (!('frameOpening' in p)) { await saveData(); return { doors: data.doors }; }
  }
  const o = p?.frameOpening;
  if (!o) delete data.doors.frameOpening;
  else {
    const f = (v, l) => num(v, `Otvor ve futrech ${l}`, { min: 0, max: 1, dp: 4 });
    const r = { x: f(o.x, 'X'), y: f(o.y, 'Y'), w: f(o.w, 'šířka'), h: f(o.h, 'výška') };
    if (r.w < 0.05 || r.h < 0.05 || r.x + r.w > 1.001 || r.y + r.h > 1.001) throw new UserError('Otvor ve futrech je moc malý nebo přesahuje obrázek');
    data.doors.frameOpening = r;
  }
  await saveData();
  return { doors: data.doors };
}

// ---------- notices (phase 8a): a timeline by date, English plain text, newest first on the site ----------
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function noticeFields(p, cur = {}) {
  const date = 'date' in p ? text(p.date, 10) : cur.date;
  if (!DATE.test(date || '') || Number.isNaN(Date.parse(date + 'T00:00:00Z'))) throw new UserError('Datum zápisu: RRRR-MM-DD');
  const body = 'text' in p ? String(p.text ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 6000) : cur.text;
  return { date, text: body ?? '' };
}
/** A new notice; an empty text is allowed while it is being written (the release check refuses it). */
export async function addNotice(p) {
  const data = await loadData();
  data.notices ??= [];
  const id = crypto.randomBytes(5).toString('hex');
  const n = { id, ...noticeFields({ date: p?.date ?? new Date().toISOString().slice(0, 10), text: p?.text ?? '' }) };
  data.notices.push(n);
  await saveData();
  return { notice: n };
}
export async function updateNotice(id, p) {
  const data = await loadData();
  const n = (data.notices || []).find(x => x.id === id);
  if (!n) throw new UserError('Takový zápis není', 404);
  Object.assign(n, noticeFields(p || {}, n));
  await saveData();
  return { notice: n };
}
export async function deleteNotice(id) {
  const data = await loadData();
  const i = (data.notices || []).findIndex(x => x.id === id);
  if (i < 0) throw new UserError('Takový zápis není', 404);
  data.notices.splice(i, 1);
  await saveData();
  return { ok: true };
}

export async function setPlates(p) {
  const data = await loadData();
  if (p.reset) { data.plates = null; await saveData(); return { plates: plates(data) }; }
  const cur = plates(data);
  const color = (v, n) => { if (!/^#[0-9a-f]{6}$/i.test(String(v))) throw new UserError(`${n}: barva jako #rrggbb`); return String(v).toLowerCase(); };
  const font = (v, n) => { if (!FONTS.includes(v)) throw new UserError(`${n}: neznámé písmo`); return v; };
  const img = v => {
    if (!v) return null;
    const m = media(data, v);
    if (m.kind !== 'plate') throw new UserError(`Cedulka musí být obrázek druhu „${KINDS.plate.label}“`);
    return v;
  };
  const RULES = {
    nameplate: { media: img, font: v => font(v, 'Písmo nadpisu'), color: v => color(v, 'Barva nadpisu'), size: v => num(v, 'Velikost nadpisu', { min: 16, max: 120 }),
      subFont: v => font(v, 'Písmo podtitulu'), subColor: v => color(v, 'Barva podtitulu'), subSize: v => num(v, 'Velikost podtitulu', { min: 8, max: 48 }),
      w: v => num(v, 'Šířka jmenovky', { min: 200, max: 1400 }), dy: v => num(v, 'Posun textu', { min: -200, max: 200 }), engraved: v => !!v },
    plaque: { media: img, font: v => font(v, 'Písmo štítku'), color: v => color(v, 'Barva textu'), numColor: v => color(v, 'Barva čísla'),
      size: v => num(v, 'Velikost písma', { min: 8, max: 36 }), ends: v => num(v, 'Okraje cedulky', { min: 0, max: 45 }), engraved: v => !!v },
  };
  for (const part of Object.keys(RULES)) {
    for (const [k, v] of Object.entries(p[part] || {})) {
      if (!RULES[part][k]) throw new UserError(`Neznámé nastavení: ${part}.${k}`);
      cur[part][k] = RULES[part][k](v);
    }
  }
  data.plates = cur;
  await saveData();
  return { plates: cur };
}

// ---------- wall and cabinet ----------

const ROLES = {
  wallpaper: ['wall', 'wallpaper', 'tile'],
  grime: ['wall', 'grime', 'grime'],
  cabinetBody: ['cabinet', 'body', 'cabinet'],
  tray: ['cabinet', 'tray', 'tray'],
  doorsClosed: ['doors', 'closed', 'doors'],
  doorsAjar: ['doors', 'ajar', 'doors'],
  doorsSound: ['doors', 'sound', 'sound'],
  doorsFrame: ['doors', 'frame', 'doors'],   // the casing around the doors, a picture with a see-through opening
};
const kindLabel = k => KINDS[k]?.label || (k === 'sound' ? 'Zvuk' : k);

/** Puts a media item into a fixed role (wallpaper, grime, cabinet body, drawer velvet), or clears it with null. */
export async function setRole(role, id) {
  const r = ROLES[role];
  if (!r) throw new UserError('Neznámá role obrázku');
  const data = await loadData();
  if (id) {
    const m = media(data, id);
    if (m.kind !== r[2]) throw new UserError(`Sem patří „${kindLabel(r[2])}“, tohle je „${kindLabel(m.kind)}“`);
  }
  data[r[0]] ||= {};
  data[r[0]][r[1]] = id || null;
  await saveData();
  return { wall: data.wall, cabinet: data.cabinet, doors: data.doors };
}

export async function updateWall(patch) {
  const data = await loadData();
  if ('tileWorld' in patch) data.wall.tileWorld = num(patch.tileWorld, 'Velikost dlaždice', { min: 50, max: 4000 });
  if ('grimeOpacity' in patch) data.wall.grimeOpacity = num(patch.grimeOpacity, 'Krytí špíny', { min: 0, max: 1 });
  await saveData();
  return { wall: data.wall };
}

export async function updateCabinet(patch) {
  const data = await loadData();
  const c = data.cabinet;
  if ('x' in patch) c.x = num(patch.x, 'Skříň X');
  if ('top' in patch) c.top = num(patch.top, 'Skříň nahoře');
  if ('w' in patch) c.w = num(patch.w, 'Šířka skříně', { min: 200, max: 6000 });
  if ('cutY' in patch) c.cutY = patch.cutY === '' || patch.cutY == null ? undefined : num(patch.cutY, 'Spodní hrana pohledu', { min: 0, max: 6000 });
  if ('drawers' in patch) {
    if (!Array.isArray(patch.drawers) || patch.drawers.length > 20) throw new UserError('Šuplíky: čekám seznam (nejvýš 20)');
    c.drawers = patch.drawers.map((d, i) => {
      const n = `Šuplík ${i + 1}`;
      if (d.front) { const m = media(data, d.front); if (m.kind !== 'drawer') throw new UserError(`${n}: čelo musí být obrázek druhu „${KINDS.drawer.label}“`); }
      return { front: d.front || null, x: num(d.x, `${n} X`, { min: 0, max: 6000 }), y: num(d.y, `${n} Y`, { min: 0, max: 6000 }),
        w: num(d.w, `${n} šířka`, { min: 20, max: 6000 }), h: num(d.h, `${n} výška`, { min: 20, max: 6000 }) };
    });
  }
  if (c.cutY === undefined) delete c.cutY;
  await saveData();
  return { cabinet: c };
}

// ---------- items ----------

function uniqueId(data, base) {
  const root = (base || 'item').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
  let id = root, n = 2;
  while (data.items.some(i => i.id === id)) id = `${root}-${n++}`;
  return id;
}

const SHAPES = ['rect', 'oval'];
const PH_PAINT = ['art', 'object'];
const PH_SHAPES = ['rect', 'oval', 'circle', 'arch'];
const PH_MATS = ['gold', 'antique', 'walnut', 'ebony', 'verdigris', 'oxblood'];

// A canvas placeholder (phase 1) may only be moved or rescaled, never invented: its painter must exist.
function cleanPlaceholder(ph) {
  if (!ph || !PH_PAINT.includes(ph.paint) || !/^[a-zA-Z]{1,30}$/.test(ph.name || '')) throw new UserError('Neplatná zástupná malba');
  const out = { paint: ph.paint, name: ph.name, seed: Math.round(num(ph.seed, 'Semínko malby', { min: 0, max: 1e7 })),
    w: num(ph.w, 'Šířka malby', { min: 10, max: 4000 }), h: num(ph.h, 'Výška malby', { min: 10, max: 4000 }) };
  if (ph.frame) {
    const f = ph.frame;
    if (!PH_SHAPES.includes(f.shape) || !PH_MATS.includes(f.mat)) throw new UserError('Neplatný rám zástupné malby');
    out.frame = { shape: f.shape, mat: f.mat, fw: num(f.fw, 'Šířka rámu', { min: 0, max: 200 }) };
    if (f.ornate) out.frame.ornate = true;
  }
  return out;
}

// `siblings` = the other items the slug and inventory number must not clash with.
function applyItemPatch(data, it, p, siblings = data.items) {
  if ('x' in p) it.x = num(p.x, 'X');
  if ('y' in p) it.y = num(p.y, 'Y');
  if ('w' in p) it.w = num(p.w, 'Šířka', { min: 10, max: 4000 });
  // ±45° on the wall and the cabinet; lying in a drawer a thing may point any way (checked at the end)
  if ('rotation' in p) it.rotation = num(p.rotation, 'Natočení', { min: -180, max: 180 });
  if ('z' in p) it.z = num(p.z, 'Vrstva', { min: -100, max: 100 });
  // the notices board: a hung item that opens the notices panel instead of a gallery (not an exhibit)
  if ('opens' in p) { if (p.opens === 'notices') it.opens = 'notices'; else if (!p.opens) delete it.opens; else throw new UserError('„opens“ umí jen "notices"'); }
  // standing on a shelf of another hung item (a bookcase): it moves along with it; checked against the
  // whole layout in replaceLayout
  if ('sits' in p) { if (p.sits) it.sits = text(p.sits, 60); else delete it.sits; }
  // the plaque's own offset from its default place (the lower right corner of the exhibit, world px). Martin
  // drags it in the editor; it is relative to the exhibit, so it travels with it. 0 / 0 is "not moved".
  if ('plaqueAt' in p) {
    const a = p.plaqueAt;
    const dx = a ? num(a.dx ?? 0, 'Cedulka X', { min: -1500, max: 1500, dp: 1 }) : 0;
    const dy = a ? num(a.dy ?? 0, 'Cedulka Y', { min: -1500, max: 1500, dp: 1 }) : 0;
    if (dx || dy) it.plaqueAt = { dx, dy }; else delete it.plaqueAt;
  }
  // an exhibit taken off the wall is kept in storage (off) with its texts and gallery, never published
  if ('off' in p) { if (p.off) it.off = true; else delete it.off; }
  if ('on' in p) { if (p.on && p.on !== 'cabinet') throw new UserError('„on“ umí jen "cabinet"'); it.on = p.on || undefined; }
  if ('drawer' in p) {
    if (p.drawer === null || p.drawer === '') { delete it.drawer; delete it.dx; delete it.dy; }
    else { it.drawer = num(p.drawer, 'Šuplík', { min: 0, max: 19 }); it.dx = num(p.dx ?? 0.5, 'Pozice v šuplíku X', { min: 0, max: 1 }); it.dy = num(p.dy ?? 0.45, 'Pozice v šuplíku Y', { min: 0, max: 1 }); }
  }
  if ('exhibit' in p) {
    const e = p.exhibit;
    if (!e) delete it.exhibit;
    else {
      const slug = text(e.slug ?? it.exhibit?.slug ?? it.id, 60);
      if (!SLUG.test(slug)) throw new UserError('Adresa exponátu (slug): jen malá písmena, číslice a pomlčky');
      if (siblings.some(o => o !== it && o.exhibit?.slug === slug)) throw new UserError(`Adresu „${slug}“ už má jiný exponát`);
      const nextInv = Math.max(0, ...siblings.filter(o => o !== it).map(o => o.exhibit?.inv || 0)) + 1;
      const inv = e.inv != null && e.inv !== '' ? num(e.inv, 'Inventární číslo', { min: 1, max: 9999 }) : it.exhibit?.inv ?? nextInv;
      const clash = siblings.find(o => o !== it && o.exhibit?.inv === inv);
      if (clash) throw new UserError(`Inventární číslo ${inv} už má ${clash.exhibit.title || clash.id}`);
      const gallery = [...new Set(e.gallery ?? it.exhibit?.gallery ?? [])].map(g => { if (!data.media[g]) throw new UserError('Galerie odkazuje na obrázek, který v knihovně není'); return g; });
      const capsIn = e.captions ?? it.exhibit?.captions ?? {};
      const captions = Object.fromEntries(gallery.filter(g => text(capsIn[g], 300)).map(g => [g, text(capsIn[g], 300)]));
      it.exhibit = {
        slug, inv,
        title: text(e.title ?? it.exhibit?.title, 120), medium: text(e.medium ?? it.exhibit?.medium, 200),
        description: text(e.description ?? it.exhibit?.description, 4000),
        tags: (e.tags ?? it.exhibit?.tags ?? []).map(t => text(t, 40)).filter(Boolean).slice(0, 12),
        gallery, plaque: e.plaque ?? it.exhibit?.plaque ?? true,
      };
      if (Object.keys(captions).length) it.exhibit.captions = captions;
    }
  }
  if ('opening' in p) {
    const o = p.opening;
    if (!o) delete it.opening;
    else {
      if (!SHAPES.includes(o.shape)) throw new UserError('Otvor: tvar je rect nebo oval');
      const f = (v, l) => num(v, `Otvor ${l}`, { min: 0, max: 1, dp: 4 });
      it.opening = { shape: o.shape, x: f(o.x, 'X'), y: f(o.y, 'Y'), w: f(o.w, 'šířka'), h: f(o.h, 'výška') };
      if (it.opening.x + it.opening.w > 1.001 || it.opening.y + it.opening.h > 1.001) throw new UserError('Otvor přesahuje obrázek');
    }
  }
  if (it.drawer == null && Math.abs(it.rotation || 0) > 45) throw new UserError('Natočení: na stěně a na skříni nejvýš ±45°, víc jen v šuplíku');
  for (const k of ['on', 'z']) if (it[k] === undefined || (k === 'z' && it[k] === 0)) delete it[k];
}

const ITEM_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Replaces the whole layout at once (the wall editor saves this way, which is also what makes its undo
 * simple): every item is rebuilt from scratch through the same validation as a single PATCH.
 */
export async function replaceLayout({ items, nameplate, view, room, rev }) {
  const data = await loadData();
  if (rev && rev !== layoutRev(data)) throw new UserError('Rozvržení se mezitím změnilo jinde (jiná karta nebo okno). Načti editor znovu (⌘R), jinak by se změny přepsaly.', 409);
  if (!Array.isArray(items) || items.length > 2000) throw new UserError('Rozvržení: čekám seznam položek');
  const out = [];
  for (const raw of items) {
    const id = String(raw?.id || '');
    if (!ITEM_ID.test(id) || id.length > 60) throw new UserError(`Neplatné ID položky „${id}“`);
    if (out.some(o => o.id === id)) throw new UserError(`ID „${id}“ je v rozvržení dvakrát`);
    const it = { id };
    if (raw.media) {
      const m = media(data, raw.media);
      if (m.kind !== 'item') throw new UserError(`${id}: na stěnu jde jen obrázek druhu „${KINDS.item.label}“`);
      it.media = raw.media;
      if (raw.w == null) throw new UserError(`${id}: chybí šířka`);
    } else it.placeholder = cleanPlaceholder(raw.placeholder);
    const { id: _i, media: _m, placeholder: _p, ...patch } = raw;
    try { applyItemPatch(data, it, { x: 0, y: 0, rotation: 0, ...patch }, out); }
    catch (err) { throw err instanceof UserError ? new UserError(`${id}: ${err.message}`) : err; }
    if (it.drawer != null) { delete it.on; delete it.x; delete it.y; }
    if (!it.media) delete it.w;
    out.push(it);
  }
  // one notices board at most, and it is never an exhibit (no number, no plaque, no page)
  const boards = out.filter(i => i.opens);
  if (boards.length > 1) throw new UserError('Aktuality může otevírat jen jedna věc na stěně');
  if (boards[0]?.exhibit) throw new UserError('Tabule s aktualitami nemůže být zároveň exponát');
  if (boards[0] && (boards[0].drawer != null || boards[0].on)) throw new UserError('Tabule s aktualitami musí viset na stěně');
  // a thing can only stand on something that hangs on the wall (not itself, not in a drawer or storage)
  for (const it of out) {
    if (!it.sits) continue;
    const host = out.find(o => o.id === it.sits);
    if (!host || host === it || host.drawer != null || host.on || host.off || it.drawer != null || it.on) delete it.sits;
  }
  data.items = out;
  if (nameplate) {
    data.nameplate = { ...data.nameplate, x: num(nameplate.x, 'Jmenovka X'), y: num(nameplate.y, 'Jmenovka Y') };
  }
  // where the page opens (null = above the middle of the cabinet)
  if (view !== undefined) data.view = view ? { x: num(view.x, 'Střed stránky X'), y: num(view.y, 'Střed stránky Y') } : null;
  // the room's size (null = grows with its content); its bottom is always the page end (cabinet.cutY)
  if (room !== undefined) {
    if (!room) data.room = null;
    else {
      const r = { x0: num(room.x0, 'Místnost vlevo'), x1: num(room.x1, 'Místnost vpravo'), y0: num(room.y0, 'Místnost nahoře') };
      if (r.x1 - r.x0 < 600) throw new UserError('Místnost musí být široká aspoň 600 px stěny');
      data.room = r;
    }
  }
  await saveData();
  return { items: data.items, nameplate: data.nameplate, view: data.view ?? null, room: data.room ?? null, rev: layoutRev(data) };
}

export async function addItem(p) {
  const data = await loadData();
  const m = media(data, p.media);
  if (m.kind !== 'item') throw new UserError(`Na stěnu jde jen obrázek druhu „${KINDS.item.label}“`);
  const it = { id: uniqueId(data, p.id || path.parse(m.name || 'item').name), media: p.media, x: 0, y: 0, w: Math.min(m.w, 400), rotation: 0 };
  applyItemPatch(data, it, p);
  data.items.push(it);
  await saveData();
  return { item: it };
}

export async function updateItem(id, p) {
  const data = await loadData();
  const it = data.items.find(i => i.id === id);
  if (!it) throw new UserError('Taková položka na stěně není');
  if ('media' in p) {
    const m = media(data, p.media);
    if (m.kind !== 'item') throw new UserError(`Na stěnu jde jen obrázek druhu „${KINDS.item.label}“`);
    // a real image replacing a placeholder starts at the placeholder's outer width (frame included)
    if (it.w == null) {
      const ph = it.placeholder, fw = ph?.frame ? ph.frame.fw + 6 : 0;
      it.w = ph ? ph.w + 2 * fw : Math.min(m.w, 400);
    }
    it.media = p.media; delete it.placeholder;
  }
  applyItemPatch(data, it, p);
  await saveData();
  return { item: it };
}

export async function deleteItem(id) {
  const data = await loadData();
  const i = data.items.findIndex(x => x.id === id);
  if (i < 0) throw new UserError('Taková položka na stěně není');
  data.items.splice(i, 1);
  await saveData();
  return { ok: true };
}
