// Load/save data/cabinet.json, the single source of truth (atomic write, serialized).

import fs from 'node:fs/promises';
import path from 'node:path';
import { PATHS } from './config.mjs';

export const DEFAULT_DATA = {
  version: 1,
  settings: {
    siteUrl: 'https://cabinet.martinposta.com/', // absolute public URL: canonical, Open Graph, sitemap
    description: 'Personal projects, shown as a night visit to a cabinet of curiosities.',
    customDomain: 'cabinet.martinposta.com',
    plateTitle: 'Cabinet of Curiosities',
    plateSubtitle: 'Personal projects',
    defaultLook: null,
    analyticsToken: '',
    fx: { castShadows: true, frameLips: true, roomCandleShadows: true, handCandle: true }, // effect switches (phase 6)
  },
  nameplate: { x: 0, y: -340, w: 540, h: 132 }, // world centre and size; text is live HTML
  // how the nameplate and the plaques look; media null = the painted brass (see PLATE_DEFAULTS)
  plates: null,
  surround: null, // the room's surround (side panels, cornice, wainscot) – see SURROUND_DEFAULTS
  room: null, // fixed room size {x0,x1,y0}; null = grows with the content (bottom: always the page end)
  view: null, // where the page opens (world point); null = above the middle of the cabinet
  doors: { closed: null, ajar: null, sound: null }, // entrance page (D14): two photos + the creak
  wall: { wallpaper: null, tileWorld: 280, grime: null },
  cabinet: { x: 0, top: 1480, body: null, drawers: [] },
  media: {},
  items: [],
};

let cache = null;

export async function loadData() {
  if (cache) return cache;
  let raw = null;
  try { raw = JSON.parse(await fs.readFile(PATHS.data, 'utf8')); }
  catch (err) { if (err.code !== 'ENOENT') throw err; }
  cache = { ...structuredClone(DEFAULT_DATA), ...(raw || {}), settings: { ...DEFAULT_DATA.settings, ...(raw?.settings || {}) } };
  if (!raw) await saveData();
  return cache;
}

/** Forget the in-memory copy and read data/cabinet.json again (git has just rewritten it). */
export function reloadData() { cache = null; return loadData(); }

let writeChain = Promise.resolve();

export function saveData() {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(PATHS.data), { recursive: true });
    await fs.writeFile(PATHS.data + '.tmp', JSON.stringify(cache, null, 2) + '\n', 'utf8');
    await fs.rename(PATHS.data + '.tmp', PATHS.data);
  });
  return writeChain;
}
