// Central paths and settings. ROOT_DIR = code, DATA_ROOT = data/ + docs/ (tests point it at a temp dir).

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_ROOT = process.env.KABINET_DATA_ROOT ? path.resolve(process.env.KABINET_DATA_ROOT) : ROOT_DIR;

export const PATHS = {
  data: path.join(DATA_ROOT, 'data', 'cabinet.json'), // source of truth (committed)
  siteSrc: path.join(ROOT_DIR, 'site'),               // public site SOURCE
  docs: path.join(DATA_ROOT, 'docs'),                 // GENERATED, served by GitHub Pages
  adminPublic: path.join(ROOT_DIR, 'admin', 'public'),
  media: path.join(DATA_ROOT, 'docs', 'media'),        // derivatives, docs/media/<id>/<width>.webp
  mediaTmp: path.join(DATA_ROOT, '.media-tmp'),         // renders in progress (outside docs/, which builds rewrite)
  looks: path.join(ROOT_DIR, 'data', 'looks.json'),     // look presets (committed)
  inbox: path.join(DATA_ROOT, 'assets-inbox'),          // Martin's originals (git-ignored)
  originals: path.join(DATA_ROOT, 'assets-inbox', '_imported'), // a copy of every imported original, by media id (D6)
  luts: path.join(DATA_ROOT, 'assets-inbox', 'looks'),  // optional .cube LUTs
};

// What an imported image becomes, by kind. `widths` are generated (capped by the original), `max` is the
// long edge everything is first reduced to (the look is applied at that size). Sizes in px of the file;
// a world px is a CSS px at zoom 1, and the wall is seen at zoom <= 1.25 on displays up to DPR 2.
export const KINDS = {
  item:    { label: 'Věc na stěnu / předmět', widths: [640, 1280, 1600], max: 1600, min: 400, og: true },
  gallery: { label: 'Fotka do galerie exponátu', widths: [960, 2048], max: 2048, min: 960, og: true },
  tile:    { label: 'Tapeta (bezešvá dlaždice)', widths: [], max: 2048, min: 512 },
  grime:   { label: 'Špína a skvrny přes stěnu', widths: [1600, 3200], max: 3200, min: 1600 },
  cabinet: { label: 'Skříň (korpus)', widths: [1280, 2560], max: 2560, min: 1600 },
  drawer:  { label: 'Čelo šuplíku', widths: [640, 1024, 1600], max: 1600, min: 600 },
  tray:    { label: 'Samet do šuplíku', widths: [], max: 1024, min: 400 },
  doors:   { label: 'Dveře (úvodní stránka)', widths: [1280, 2400], max: 3200, min: 1600, og: true },
  // brass plates: the nameplate (~540 world px) and the plaques under exhibits; text stays live over them
  plate:   { label: 'Cedulka (jmenovka, štítek)', widths: [640, 1280], max: 1600, min: 300 },
  // the room's surround: side panels, cornice and wainscot, laid along the room's edges (most of them repeat)
  surround: { label: 'Obložení místnosti (bok, římsa, lambrie)', widths: [800, 1600], max: 2400, min: 400 },
  // the notices board close up (the opened panel): frame and slate in one picture, the text area drawn on it
  board:   { label: 'Tabule s aktualitami – detail', widths: [1200, 1800], max: 2400, min: 800 },
};

export const IMAGE = {
  quality: 82,
  alphaQuality: 90,
  og: { width: 1200, quality: 80 },
  acceptedExt: ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'],
  // sounds are published as uploaded (no conversion, no dependency); mp3 plays everywhere
  soundExt: { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav' },
  maxSound: 2 * 1024 * 1024,
  maxInputPixels: 300e6,
};

export const ADMIN = {
  host: '127.0.0.1', // localhost only, never exposed to the network
  port: Number(process.env.PORT) || 4322,
};
