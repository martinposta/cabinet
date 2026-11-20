// Release check (`npm run check-release`): everything that must be true before the site goes public.
// Read-only – it never changes data, docs or git. Two parts:
//   content  what a visitor will see: titles, descriptions, photos, doors, settings, media files
//   audit    what the PUBLIC repository would carry: originals, metadata/GPS, personal paths, secrets
// Findings are { level: 'error' | 'warn' | 'info', area, msg }. Errors block a release, warnings are
// decisions for Martin, info is context. Messages are Czech (they are read in the terminal/admin).

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { PATHS, ROOT_DIR, DATA_ROOT } from './config.mjs';
import { loadData } from './store.mjs';

const run = promisify(execFile);
const git = (args, cwd = DATA_ROOT) => run('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 }).then(r => r.stdout);

/** A title that is really a camera file name ("Dscf2810", "IMG_4412"). */
export const looksLikeFileName = s => /^(dscf|img|dsc|pxl|pic|photo)[ _-]?\d{2,}$/i.test(String(s || '').trim());
/** Wikipedia-style citation markers ("[10]", "[citation needed]") left in pasted text. */
export const hasCitationMarks = s => /\[\d{1,3}\]|\[citation needed\]/i.test(String(s || ''));

/** Does a raw EXIF block (as sharp returns it) carry a GPS IFD? Walks IFD0 for tag 0x8825. */
export function exifHasGps(buf) {
  if (!buf || buf.length < 14) return false;
  let o = buf.subarray(0, 6).toString('latin1') === 'Exif\0\0' ? 6 : 0; // TIFF header start
  const le = buf.toString('latin1', o, o + 2) === 'II';
  const u16 = p => (le ? buf.readUInt16LE(p) : buf.readUInt16BE(p));
  const u32 = p => (le ? buf.readUInt32LE(p) : buf.readUInt32BE(p));
  try {
    const ifd = o + u32(o + 4), n = u16(ifd);
    for (let i = 0; i < n; i++) if (u16(ifd + 2 + i * 12) === 0x8825) return true;
  } catch { /* truncated block: treat as no GPS */ }
  return false;
}

// ---------- content ----------

export async function contentFindings(data = null) {
  data ||= await loadData();
  const out = [];
  const add = (level, area, msg) => out.push({ level, area, msg });
  const S = data.settings || {};
  const exhibits = data.items.filter(i => i.exhibit && !i.off);
  const stored = data.items.filter(i => i.exhibit && i.off).length;
  add('info', 'Obsah', `Na stěně je ${exhibits.length} exponátů${stored ? `, ${stored} uložených mimo stěnu (na web nejdou)` : ''}.`);

  // exhibits
  const slugs = new Map(), invs = new Map();
  // the notices board: a written-but-empty entry would show as a bare date
  const emptyNotices = (data.notices || []).filter(n => !String(n.text || '').trim());
  if (emptyNotices.length) add('error', 'Aktuality', `${emptyNotices.length} ${emptyNotices.length === 1 ? 'zápis nemá' : 'zápisy nemají'} text (${emptyNotices.map(n => n.date).join(', ')}) – dopsat, nebo smazat.`);
  for (const it of exhibits) {
    const e = it.exhibit, who = `„${e.title || e.slug}“ (inv. ${e.inv})`;
    slugs.set(e.slug, (slugs.get(e.slug) || 0) + 1);
    invs.set(e.inv, (invs.get(e.inv) || 0) + 1);
    if (!String(e.title || '').trim()) add('error', 'Exponáty', `Exponát ${e.slug} nemá název.`);
    else if (looksLikeFileName(e.title) || e.title.trim().toLowerCase() === e.slug) add('error', 'Exponáty', `${who}: název vypadá jako jméno souboru.`);
    if (!String(e.description || '').trim()) add('error', 'Exponáty', `${who}: chybí popis.`);
    else if (hasCitationMarks(e.description)) add('warn', 'Exponáty', `${who}: popis obsahuje značky citací ([10]…), vypadá jako zkopírovaný text – přepsat, nebo uvést zdroj a licenci.`);
    const photos = (e.gallery || []).filter(id => data.media[id]);
    if ((e.gallery || []).length !== photos.length) add('error', 'Exponáty', `${who}: galerie odkazuje na fotku, která v knihovně není.`);
    if (it.media && !data.media[it.media]) add('error', 'Exponáty', `${who}: předmět na stěně odkazuje na chybějící médium.`);
  }
  // no warning for exhibits without gallery photos or without a medium: not every exhibit gets them (Martin)
  for (const [s, n] of slugs) if (n > 1) add('error', 'Exponáty', `Adresa „${s}“ má víc exponátů.`);
  for (const [v, n] of invs) if (n > 1) add('warn', 'Exponáty', `Inventární číslo ${v} mají ${n} exponáty.`);

  // settings
  if (!S.siteUrl) add('error', 'Nastavení', 'Chybí adresa webu (siteUrl) – bez ní nevznikne sitemap ani odkazy pro sdílení.');
  else if (!/^https:\/\/.+\/$/.test(S.siteUrl)) add('error', 'Nastavení', `Adresa webu „${S.siteUrl}“ musí být https a končit lomítkem.`);
  if (!S.customDomain) add('warn', 'Nastavení', 'Chybí vlastní doména (soubor CNAME se nevytvoří).');
  else if (S.siteUrl && !S.siteUrl.includes(S.customDomain)) add('error', 'Nastavení', 'Adresa webu a vlastní doména si neodpovídají.');
  if (!String(S.description || '').trim()) add('error', 'Nastavení', 'Chybí popis webu (zobrazí se ve vyhledávání a při sdílení).');
  if (!String(S.plateTitle || '').trim()) add('warn', 'Nastavení', 'Chybí titulek jmenovky.');
  add(S.noindex ? 'warn' : 'info', 'Nastavení', S.noindex ? 'Web je skrytý před vyhledávači (noindex, bez sitemap). Pro ostré spuštění vypnout v Místnost → Adresa a popis.' : 'Web je otevřený vyhledávačům (bez noindex).');
  if (!S.analyticsToken) add('info', 'Nastavení', 'Analytika (Cloudflare Web Analytics) zatím nemá token – web poběží bez měření, dá se doplnit kdykoli.');

  // doors
  const D = data.doors || {};
  for (const [key, label] of [['closed', 'zavřené dveře'], ['ajar', 'pootevřené dveře'], ['frame', 'rám dveří']]) {
    if (!D[key]) add('warn', 'Dveře', `Chybí obrázek: ${label}${key === 'closed' ? ' (nahradí ho malovaný zástupný obrázek)' : ''}.`);
    else if (!data.media[D[key]]) add('error', 'Dveře', `${label}: médium v knihovně neexistuje.`);
  }
  if (!D.sound) add('info', 'Dveře', 'Bez zvuku vrznutí.');

  // media files really there
  const used = new Set();
  const walk = v => { if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x); else if (typeof v === 'string' && data.media[v]) used.add(v); };
  walk({ items: data.items, doors: data.doors, cabinet: data.cabinet, plates: data.plates, surround: data.surround, wall: data.wall, handCandle: data.handCandle, room: data.room });
  let missing = 0;
  for (const [id, m] of Object.entries(data.media)) {
    const dir = path.join(PATHS.media, id);
    if (m.kind === 'tile' || m.widths?.length === 0) { if (!existsSync(dir)) { add('error', 'Média', `Médium ${id} (${m.name}) nemá složku v docs/media.`); missing++; } continue; }
    for (const w of m.widths || []) if (!existsSync(path.join(dir, `${w}.webp`))) { add('error', 'Média', `Chybí docs/media/${id}/${w}.webp (${m.name}).`); missing++; }
  }
  if (!missing) add('info', 'Média', `Všech ${Object.keys(data.media).length} médií má své soubory v docs/media.`);
  const unused = Object.entries(data.media).filter(([id]) => !used.has(id));
  if (unused.length) add('info', 'Média', `${unused.length} médií v knihovně nikde není použito (nic to nestojí, ale zbytečně zvětšují web): ${unused.map(([, m]) => m.name).slice(0, 5).join(', ')}${unused.length > 5 ? '…' : ''}`);

  // link previews
  for (const it of exhibits) {
    const cover = (it.exhibit.gallery || []).find(id => data.media[id]) || it.media;
    if (cover && !existsSync(path.join(PATHS.media, cover, 'og.jpg'))) add('warn', 'Sdílení', `„${it.exhibit.title}“ nemá og.jpg, při sdílení se použije obrázek webu.`);
  }
  if (D.closed && !existsSync(path.join(PATHS.media, D.closed, 'og.jpg'))) add('warn', 'Sdílení', 'Zavřené dveře nemají og.jpg – úvodní stránka se bude sdílet bez obrázku.');

  // built site is current
  for (const f of ['index.html', 'cabinet/index.html', 'list/index.html', '404.html', 'robots.txt', ...(S.noindex ? [] : ['sitemap.xml']), 'CNAME', 'data.json']) {
    if (!existsSync(path.join(PATHS.docs, f))) add('error', 'Build', `V docs/ chybí ${f} – spusť npm run rebuild.`);
  }
  for (const it of exhibits) if (!existsSync(path.join(PATHS.docs, 'e', it.exhibit.slug, 'index.html'))) add('error', 'Build', `V docs/ chybí stránka exponátu ${it.exhibit.slug} – spusť npm run rebuild.`);
  return out;
}

// ---------- audit of what goes public ----------

const SECRETS = [
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/github_pat_[A-Za-z0-9_]{30,}/, 'GitHub token'],
  [/cfut_[A-Za-z0-9]{20,}|CLOUDFLARE_API_TOKEN\s*=\s*\S{10,}/, 'Cloudflare token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'soukromý klíč'],
  [/sk-[A-Za-z0-9]{32,}/, 'API klíč'],
];
const PERSONAL = [
  [/\/Users\/[A-Za-z0-9._-]+/, 'osobní cesta na disku'],
  [/\b192\.168\.\d+\.\d+\b/, 'adresa z domácí sítě'],
];
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const TEXT_EXT = /\.(html|js|mjs|css|txt|svg|json|md|command|cmd|xml)$/i;

async function listFiles(dir, skip = () => false, rel = '') {
  const out = [];
  for (const e of await fs.readdir(path.join(dir, rel), { withFileTypes: true }).catch(() => [])) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (skip(r, e)) continue;
    if (e.isDirectory()) out.push(...await listFiles(dir, skip, r)); else out.push(r);
  }
  return out;
}

export async function auditFindings() {
  const out = [];
  const add = (level, area, msg) => out.push({ level, area, msg });
  const inGit = existsSync(path.join(DATA_ROOT, '.git'));

  // 1. what git tracks / would publish
  let tracked = [];
  if (inGit) {
    tracked = (await git(['ls-files', '-z'])).split('\0').filter(Boolean);
    const originals = tracked.filter(f => /\.(jpe?g|png|heic|tiff?)$/i.test(f) && !f.startsWith('docs/') && !f.startsWith('site/') && !f.startsWith('admin/'));
    if (originals.length) {
      const dirs = [...new Set(originals.map(f => f.split('/')[0]))];
      add('error', 'Repozitář', `Git sleduje ${originals.length} originálních fotek mimo web (${dirs.join(', ')}). Z veřejného repozitáře by je šlo stáhnout i s metadaty. Odebrat z gitu (git rm --cached) a přidat do .gitignore.`);
    }
    const ign = (await git(['check-ignore', 'assets-inbox/x']).catch(() => '')).trim();
    if (!ign) add('error', 'Repozitář', 'assets-inbox/ není v .gitignore – originály s metadaty by šly ven (D6).');
    const nonDocs = tracked.filter(f => f.startsWith('data/'));
    add('info', 'Repozitář', `Git sleduje ${tracked.length} souborů (${tracked.filter(f => f.startsWith('docs/')).length} ve vygenerovaném webu, ${nonDocs.length} dat).`);
    const authors = [...new Set((await git(['log', '--all', '--format=%ae%n%ce'])).split('\n').filter(Boolean))];
    // allowed: GitHub's per-user noreply address, and GitHub's own committer (noreply@github.com) on the
    // commits GitHub itself makes – e.g. „Create CNAME“ when the custom domain is set in the Pages settings
    const bad = authors.filter(a => !/@users\.noreply\.github\.com$/.test(a) && a !== 'noreply@github.com');
    if (bad.length) add('error', 'Repozitář', `V historii je osobní e-mail autora: ${bad.join(', ')}.`);
    const cfgEmail = (await git(['config', 'user.email']).catch(() => '')).trim();
    if (cfgEmail && !/@users\.noreply\.github\.com$/.test(cfgEmail)) add('error', 'Repozitář', `Git v tomto repozitáři commituje s osobním e-mailem ${cfgEmail}.`);
    const hist = (await git(['rev-list', '--count', 'HEAD']).catch(() => '0')).trim();
    add('info', 'Repozitář', `Historie má ${hist} commitů. Čistý první commit by z veřejného repozitáře odstranil i staré verze originálů.`);
  } else add('info', 'Repozitář', 'Složka není git repozitář.');

  // 2. published files: metadata, GPS
  const media = await listFiles(PATHS.docs, (r, e) => !e.isDirectory() && !/\.(webp|jpe?g|png|gif)$/i.test(e.name));
  let withMeta = 0, withGps = 0;
  for (const f of media) {
    const m = await sharp(path.join(PATHS.docs, f)).metadata().catch(() => null);
    if (!m) continue;
    if (m.exif || m.xmp || m.iptc) withMeta++;
    if (exifHasGps(m.exif)) withGps++;
  }
  if (withGps) add('error', 'Publikované soubory', `${withGps} obrázků ve webu nese GPS souřadnice.`);
  if (withMeta) add('error', 'Publikované soubory', `${withMeta} obrázků ve webu nese metadata (EXIF/XMP).`);
  if (!withGps && !withMeta) add('info', 'Publikované soubory', `Žádný z ${media.length} obrázků ve webu nenese EXIF, XMP ani GPS.`);

  // 3. text that would be public: docs/, data/, sources, docs
  const scan = tracked.length ? tracked.filter(f => TEXT_EXT.test(f)) : await listFiles(DATA_ROOT, r => /^(node_modules|\.git|assets-inbox)(\/|$)/.test(r));
  const hits = new Map();
  for (const f of scan) {
    const txt = await fs.readFile(path.join(DATA_ROOT, f), 'utf8').catch(() => '');
    for (const [re, what] of SECRETS) if (re.test(txt)) add('error', 'Tajemství', `${f}: ${what}.`);
    for (const [re, what] of PERSONAL) { const m = re.exec(txt); if (m) { const k = `${what}`; (hits.get(k) || hits.set(k, []).get(k)).push(`${f} (${m[0]})`); } }
    for (const mail of txt.match(EMAIL) || []) {
      if (/noreply|@example\.|@(fontsource|sentry)|\.(png|webp|jpg)$|@\d+(\.\d+)?x$/i.test(mail) || /^[\w.-]+@\d/.test(mail)) continue;
      (hits.get('e-mailová adresa') || hits.set('e-mailová adresa', []).get('e-mailová adresa')).push(`${f} (${mail})`);
    }
  }
  for (const [what, list] of hits) add(/^docs\//.test(list[0]) || list.some(x => /^(docs|site|data)\//.test(x)) ? 'error' : 'warn', 'Osobní údaje', `${what}: ${list.slice(0, 6).join('; ')}${list.length > 6 ? ` …a dalších ${list.length - 6}` : ''}`);

  // 4. what the public data.json reveals
  try {
    const pub = JSON.parse(await fs.readFile(path.join(PATHS.docs, 'data.json'), 'utf8'));
    const names = Object.values(pub.media || {}).map(m => m.name).filter(Boolean);
    const camera = names.filter(n => /^(dscf|img|dsc)[ _-]?\d+/i.test(n));
    if (names.length) add('info', 'Publikované soubory', `docs/data.json zveřejňuje původní názvy ${names.length} souborů${camera.length ? ` (${camera.length}× čísla z foťáku, např. ${camera[0]})` : ''} a datum nahrání. Nic citlivého, ale návštěvník si je přečte.`);
  } catch { /* missing data.json is reported by the content part */ }
  return out;
}

export const sortLevel = f => ({ error: 0, warn: 1, info: 2 })[f.level];
export async function releaseReport() {
  const [content, audit] = await Promise.all([contentFindings(), auditFindings()]);
  return { content, audit, all: [...content, ...audit] };
}
