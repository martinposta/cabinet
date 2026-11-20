// Generates docs/ from data/cabinet.json + site/. Every public URL is a real file (GitHub Pages has no
// rewrites), and every page reaches its assets relative to {{ROOT}} (Fotogalerie invariant 4):
//   docs/index.html            the doors (site/doors.html, D14) – no wall code, loads instantly
//   docs/cabinet/index.html    the wall (site/wall.html)
//   docs/e/<slug>/index.html   the wall opened on one exhibit, with that exhibit's Open Graph tags
//   docs/list/index.html       plain list of all exhibits (site/list.html)
//   docs/404.html, sitemap.xml, robots.txt, CNAME, .nojekyll
//   docs/data.json             public data consumed by site/js/main.js
//   docs/css, js, fonts, …     copied from site/
//   docs/media/<id>/           image derivatives and sounds, written by the admin (kept across builds)

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PATHS, IMAGE } from './config.mjs';
import { loadData } from './store.mjs';
import { pendingMedia, cursorFiles } from './images.mjs';

// Sources are normalised to LF so the output never depends on git's line-ending handling.
export const lf = text => text.replace(/\r\n/g, '\n');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TEXT = /\.(html|js|css|txt|svg|json)$/i;
const TEMPLATES = ['wall.html', 'doors.html', 'list.html', '404.html'];

/**
 * Nameplate and plaque look (admin → Místnost → Jmenovka a štítky). The defaults are the painted brass
 * the site always had, so a cabinet without `plates` looks exactly as before. Fonts are the site's own
 * three faces (+ IM Fell italic), named by role: no font file is ever loaded for a choice.
 */
export const FONTS = ['display', 'italic', 'label', 'body'];
export const PLATE_DEFAULTS = {
  nameplate: { media: null, font: 'display', color: '#3b2707', size: 54, subFont: 'label', subColor: '#5a3d10', subSize: 15, w: 540, dy: 0, engraved: true },
  plaque: { media: null, font: 'label', color: '#2a1d0b', numColor: '#6b2a14', size: 14, ends: 30, engraved: true },
};
/**
 * The room's surround (admin → Místnost → Obložení): side panels (cap + a repeating middle; the right one
 * is the left one mirrored), a cornice along the top and a wainscot along the bottom, all laid along the
 * room's edges. Sizes in world px. Each image is optional; nothing is drawn while `on` is false.
 */
export const SURROUND_DEFAULTS = { on: false, sideTop: null, sideMid: null, cornice: null, wainscot: null, sideW: 240, corniceH: 120, wainscotH: 420 };
/**
 * The room's wallpaper around the doors (phase 8b): the same tile at its size on the wall at zoom 1
 * (tileWorld CSS px), and the grime over it (its smallest derivative, the page must stay light).
 */
function doorsWall(data) {
  const W = data.wall || {}, t = W.wallpaper && data.media[W.wallpaper], g = W.grime && data.media[W.grime];
  const BODY_STYLE = t ? `background-image:url(&quot;${esc(mediaPath(W.wallpaper, t, `${t.widths[t.widths.length - 1]}.webp`))}&quot;);background-size:${W.tileWorld || 280}px auto` : '';
  const GRIME = g ? `<div class="grime" aria-hidden="true" style="background-image:url(&quot;${esc(mediaPath(W.grime, g, `${g.widths[0]}.webp`))}&quot;);opacity:${W.grimeOpacity ?? 1}"></div>` : '';
  return { BODY_STYLE, GRIME };
}

/** The notices for the site: written ones only, newest first (same date: the later written first). */
export const publicNotices = data => (data.notices || []).filter(n => String(n.text || '').trim())
  .map((n, i) => ({ ...n, i })).sort((a, b) => b.date.localeCompare(a.date) || b.i - a.i).map(({ i, ...n }) => n);
export const surround = data => ({ ...SURROUND_DEFAULTS, ...(data.surround || {}) });
export const plates = data => ({
  nameplate: { ...PLATE_DEFAULTS.nameplate, ...(data.plates?.nameplate || {}) },
  plaque: { ...PLATE_DEFAULTS.plaque, ...(data.plates?.plaque || {}) },
});

/** Effect switches with their defaults (each one on/off in admin → Nastavení). */
export const FX = ['darkness', 'castShadows', 'frameLips', 'roomCandleShadows', 'handCandle'];
export function effects(s) {
  const fx = s.fx || {};
  // roomCandleShadows lived directly in settings before the switches were grouped
  return Object.fromEntries(FX.map(k => [k, (fx[k] ?? (k === 'roomCandleShadows' ? s.roomCandleShadows : undefined)) !== false]));
}

/** What the public site gets: no admin-only settings. */
export function publicData(data) {
  const { plateTitle, plateSubtitle } = data.settings;
  return {
    settings: { plateTitle, plateSubtitle, fx: effects(data.settings) },
    handCandle: data.handCandle || null,
    nameplate: data.nameplate,
    plates: plates(data),
    surround: surround(data),
    notices: publicNotices(data),
    view: data.view ?? null,
    room: data.room ?? null,
    wall: data.wall,
    cabinet: data.cabinet,
    media: data.media,
    items: data.items.filter(i => !i.off), // stored exhibits (off the wall) stay in the admin only
  };
}

// Every site source except the templates, as [relative path, content].
async function siteFiles(dir = PATHS.siteSrc, rel = '') {
  const out = [];
  for (const e of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await siteFiles(path.join(dir, e.name), r));
    else if (!TEMPLATES.includes(r)) {
      const buf = await fs.readFile(path.join(dir, e.name));
      out.push([r, TEXT.test(e.name) ? Buffer.from(lf(buf.toString('utf8'))) : buf]);
    }
  }
  return out;
}

const render = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));

// ---------- media URLs ----------

const mediaPath = (id, m, file) => `media/${id}/${file}?v=${m.v || 1}`;
const largest = (id, m) => mediaPath(id, m, `${m.widths[m.widths.length - 1]}.webp`);

/** The link-preview image of a media item: its og.jpg if the kind makes one, with its pixel size. */
function ogOf(data, id) {
  const m = id && data.media[id];
  if (!m || !existsSync(path.join(PATHS.media, id, 'og.jpg'))) return null;
  const s = Math.min(1, IMAGE.og.width / m.w, IMAGE.og.width / m.h);
  return { path: mediaPath(id, m, 'og.jpg'), w: Math.round(m.w * s), h: Math.round(m.h * s) };
}

// ---------- head tags ----------

/**
 * The author and their other sites, for search engines: rel="me" links and schema.org JSON-LD (a WebSite
 * whose author is a Person with sameAs). Nothing visible; a sitemap may only list this site's own URLs.
 */
function identityTags(S) {
  const site = S.siteUrl || '', links = S.authorLinks || [], name = S.authorName || '';
  if (!site || (!links.length && !name)) return [];
  const person = { '@type': 'Person', '@id': `${site}#author`, ...(name && { name }), ...(links[0] && { url: links[0] }), ...(links.length && { sameAs: links }) };
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': `${site}#site`, url: site, name: S.plateTitle || 'Cabinet of Curiosities', author: { '@id': `${site}#author` } }, person] };
  return [...links.map(l => `<link rel="me" href="${esc(l)}">`),
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`];
}

function metaTags({ title, description, url, image, noindex, identity = [] }) {
  const t = [
    ...identity,
    noindex && `<meta name="robots" content="noindex, nofollow">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(title)}">`,
    description && `<meta property="og:description" content="${esc(description)}">`,
    description && `<meta name="description" content="${esc(description)}">`,
    url && `<meta property="og:url" content="${esc(url)}">`,
    url && `<link rel="canonical" href="${esc(url)}">`,
  ];
  if (image) {
    t.push(
      `<meta property="og:image" content="${esc(image.url)}">`,
      `<meta property="og:image:width" content="${image.w}">`,
      `<meta property="og:image:height" content="${image.h}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
    );
  }
  return t.filter(Boolean).join('\n');
}

// Cloudflare Web Analytics (D13 = Fotogalerie D18): cookieless, only with a token, never on localhost.
function analyticsSnippet(token) {
  if (!token) return '';
  const beacon = JSON.stringify({ token, spa: true });
  return `<script>if(!/^(localhost|127\\.|\\[::1\\])/.test(location.hostname)){var s=document.createElement('script');` +
    `s.defer=true;s.src='https://static.cloudflareinsights.com/beacon.min.js';s.setAttribute('data-cf-beacon',${JSON.stringify(beacon)});` +
    `document.head.appendChild(s)}</script>`;
}

// ---------- the doors' stand-in ----------

// Painted doors for as long as Martin has no photographs (D3: vector art only as a placeholder).
// `.ajar` on the button swaps to the open state – one swap, no transition, like the photos.
function placeholderDoors() {
  const panel = (x, flip) => `<g class="door ${flip ? 'r' : 'l'}">
    <rect x="${x}" y="40" width="200" height="560" rx="6" fill="url(#wood)" stroke="#1b0f06" stroke-width="4"/>
    <rect x="${x + 26}" y="76" width="148" height="210" rx="4" fill="none" stroke="#2a170a" stroke-width="5"/>
    <rect x="${x + 26}" y="320" width="148" height="244" rx="4" fill="none" stroke="#2a170a" stroke-width="5"/>
    <circle cx="${flip ? x + 22 : x + 178}" cy="330" r="9" fill="#c9a24a" stroke="#4a3008" stroke-width="2"/></g>`;
  return `<svg viewBox="0 0 480 640" role="img" aria-label="Closed cabinet doors">
  <defs><linearGradient id="wood" x1="0" x2="1"><stop offset="0" stop-color="#3c2410"/><stop offset=".5" stop-color="#5b3a1f"/><stop offset="1" stop-color="#3a2210"/></linearGradient></defs>
  <style>.doors.ajar .door.r{transform:translateX(178px) scaleX(.62);transform-box:fill-box}.doors.ajar .gap{opacity:1}.gap{opacity:0}</style>
  <rect x="24" y="20" width="432" height="600" rx="8" fill="#1a0f07" stroke="#0b0603" stroke-width="6"/>
  <rect class="gap" x="240" y="40" width="200" height="560" fill="#020101"/>
  ${panel(40, false)}${panel(240, true)}</svg>`;
}

// ---------- pages ----------

function exhibitCover(data, it) {
  const g = it.exhibit.gallery?.find(id => data.media[id]);
  return g || (it.media && data.media[it.media] ? it.media : null);
}

function listHtml(data, exhibits) {
  return exhibits.map(it => {
    const e = it.exhibit, cover = exhibitCover(data, it), m = cover && data.media[cover];
    // exhibits without a photo yet get no picture box at all, rather than an empty dark one
    const img = m ? `<a href="e/${esc(e.slug)}/" tabindex="-1" aria-hidden="true"><img src="${esc(mediaPath(cover, m, `${m.widths[0]}.webp`))}" alt="" loading="lazy" width="180" height="135"></a>` : '';
    return `<article class="ex${m ? '' : ' noimg'}" id="${esc(e.slug)}">
  ${img}
  <div>
    <div class="inv">inv. no. ${String(e.inv).padStart(3, '0')}</div>
    <h2><a href="e/${esc(e.slug)}/">${esc(e.title)}</a></h2>
    ${e.medium ? `<p class="medium">${esc(e.medium)}</p>` : ''}
    ${(e.description || '').split(/\n+/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('')}
    ${e.tags?.length ? `<ul>${e.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
  </div>
</article>`;
  }).join('\n') || '<p>The cabinet is still empty.</p>';
}

async function writePage(rel, html) {
  const file = path.join(PATHS.docs, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
}

export async function buildSite() {
  const data = await loadData();
  const S = data.settings;
  // the hand candle as a system cursor when it is small enough (see cursorFiles)
  const hcm = data.handCandle?.media && data.media[data.handCandle.media];
  const cur = hcm ? await cursorFiles(data.handCandle.media, hcm, data.handCandle.height || 118).catch(() => null) : null;
  const pub = publicData(data);
  if (cur && pub.handCandle) pub.handCandle = { ...pub.handCandle, cursor: cur };
  const json = JSON.stringify(pub);
  const files = await siteFiles();
  const tpl = Object.fromEntries(await Promise.all(TEMPLATES.map(async t => [t, lf(await fs.readFile(path.join(PATHS.siteSrc, t), 'utf8'))])));

  // cache-buster: changes whenever any site source or the data changes
  const h = crypto.createHash('sha1').update(json);
  for (const t of TEMPLATES) h.update(tpl[t]);
  for (const [r, buf] of files) h.update(r).update(buf);
  const V = h.digest('hex').slice(0, 10);

  // docs/ is regenerated from scratch except docs/media/, which holds the image derivatives
  // (written by the pipeline at import, too slow to redo). Media no longer in the data are pruned.
  await fs.mkdir(PATHS.docs, { recursive: true });
  for (const e of await fs.readdir(PATHS.docs)) if (e !== 'media') await fs.rm(path.join(PATHS.docs, e), { recursive: true, force: true });
  let mediaDirs = [];
  try { mediaDirs = await fs.readdir(PATHS.media); } catch {}
  for (const d of mediaDirs) if (!data.media[d] && !pendingMedia.has(d)) await fs.rm(path.join(PATHS.media, d), { recursive: true, force: true });

  for (const [r, buf] of files) await writePage(r, buf);
  await writePage('data.json', json);

  const site = S.siteUrl || '';
  const abs = p => (site ? new URL(p, site).href : '');
  const title = S.plateTitle || 'Cabinet of Curiosities';
  // soft launch (settings.noindex): every page asks search engines to stay away; crawling stays allowed so they can read that
  const meta = o => metaTags({ ...o, noindex: !!S.noindex, identity: identityTags(S) });
  const common = { V, ANALYTICS: analyticsSnippet(S.analyticsToken) };
  const exhibits = data.items.filter(i => i.exhibit && !i.off).sort((a, b) => a.exhibit.inv - b.exhibit.inv);
  const siteImage = ogOf(data, data.doors?.closed) || ogOf(data, exhibits.map(i => exhibitCover(data, i)).find(Boolean));
  const imageAt = img => (img && site ? { url: abs(img.path), w: img.w, h: img.h } : null);

  // the doors
  const d = data.doors || {};
  const closed = d.closed && data.media[d.closed], ajar = d.ajar && data.media[d.ajar], sound = d.sound && data.media[d.sound];
  const closedHtml = closed
    ? `<img src="${esc(largest(d.closed, closed))}" srcset="${esc(closed.widths.map(w => `${mediaPath(d.closed, closed, `${w}.webp`)} ${w}w`).join(', '))}" sizes="(max-width:1200px) 92vw, 1100px" width="${closed.w}" height="${closed.h}" alt="Closed cabinet doors">`
    : placeholderDoors();
  const hc = data.handCandle, hm = hc?.media && data.media[hc.media];
  const candle = hm && effects(S).handCandle
    ? { src: largest(hc.media, hm), h: hc.height || 118, w: Math.round((hc.height || 118) * hm.w / hm.h), fx: hc.fx, fy: hc.fy, cursor: cur } : null;
  // the casing: only with a picture and the opening drawn on it
  const frame = d.frame && data.media[d.frame], fo = frame && d.frameOpening;
  const pct = v => `${(v * 100).toFixed(3)}%`;
  const portal = fo ? {
    PORTAL_START: `<div class="portal" style="--ar:${frame.w}/${frame.h};--ox:${pct(fo.x)};--oy:${pct(fo.y)};--ow:${pct(fo.w)};--oh:${pct(fo.h)}">`,
    PORTAL_END: `<img class="casing" src="${esc(largest(d.frame, frame))}" srcset="${esc(frame.widths.map(w => `${mediaPath(d.frame, frame, `${w}.webp`)} ${w}w`).join(', '))}" sizes="(max-width:1400px) 92vw, 1400px" width="${frame.w}" height="${frame.h}" alt=""></div>`,
  } : { PORTAL_START: '', PORTAL_END: '' };
  // the notices board beside the doors: a copy of the wall's board, only while that one hangs on the wall.
  // Placed in fractions of the entry box (the casing, or the doors alone): centre x/y, height.
  const wb = data.items.find(i => i.opens === 'notices' && !i.off && i.media && data.media[i.media]);
  let boardHtml = '';
  if (wb) {
    const bm = data.media[wb.media], entryAr = fo ? frame.w / frame.h : closed ? closed.w / closed.h : 0.75;
    const h = d.noticesAt?.h ?? 0.25, bw = h * bm.w / bm.h / entryAr;   // board width in entry widths
    const at = d.noticesAt || { x: 1 + 0.035 + bw / 2, y: 0.56, h };
    boardHtml = `<button class="nb-doors" id="nbDoors" type="button" aria-label="Notices board. Open the notices" style="left:${pct(at.x)};top:${pct(at.y)};height:${pct(at.h)}">`
      + `<img src="${esc(largest(wb.media, bm))}" srcset="${esc(bm.widths.map(w => `${mediaPath(wb.media, bm, `${w}.webp`)} ${w}w`).join(', '))}" sizes="320px" width="${bm.w}" height="${bm.h}" alt=""></button>`;
  }
  const doorsCfg = { ajar: ajar ? largest(d.ajar, ajar) : null, sound: sound ? mediaPath(d.sound, sound, 'sound' + sound.ext) : null, candle, dark: effects(S).darkness,
    ...(wb && { notices: publicNotices(data) }) };
  await writePage('index.html', render(tpl['doors.html'], {
    ...common, ROOT: './', TITLE: esc(title), CLOSED: closedHtml, ...portal, BOARD: boardHtml, ...doorsWall(data),
    DOORS: JSON.stringify(doorsCfg).replace(/</g, '\\u003c'),
    META: meta({ title, description: S.description, url: abs(''), image: imageAt(siteImage) }),
  }));

  // the wall, and the wall opened on each exhibit
  await writePage('cabinet/index.html', render(tpl['wall.html'], {
    ...common, ROOT: '../', TITLE: esc(title), EXHIBIT: '',
    META: meta({ title, description: S.description, url: abs('cabinet/'), image: imageAt(siteImage) }),
  }));
  for (const it of exhibits) {
    const e = it.exhibit, t = `${e.title} · ${title}`;
    await writePage(`e/${e.slug}/index.html`, render(tpl['wall.html'], {
      ...common, ROOT: '../../', TITLE: esc(t), EXHIBIT: esc(e.slug),
      META: meta({ title: t, description: e.description || e.medium || S.description, url: abs(`e/${e.slug}/`), image: imageAt(ogOf(data, exhibitCover(data, it)) || siteImage) }),
    }));
  }

  // the list, the 404, and what search engines read
  await writePage('list/index.html', render(tpl['list.html'], {
    ...common, ROOT: '../', TITLE: esc(`All exhibits · ${title}`), PLATE_TITLE: esc(title), DESCRIPTION: esc(S.description),
    LIST: listHtml(data, exhibits),
    META: meta({ title: `All exhibits · ${title}`, description: S.description, url: abs('list/'), image: imageAt(siteImage) }),
  }));
  // GitHub Pages serves 404.html at any depth, so relative links would break: it links absolutely
  // (the public address, or the domain root when none is set)
  await writePage('404.html', render(tpl['404.html'], { TITLE: esc(title), HOME: esc(site || '/') }));
  await writePage('robots.txt', `User-agent: *\nAllow: /\n${site && !S.noindex ? `Sitemap: ${abs('sitemap.xml')}\n` : ''}`);
  if (site && !S.noindex) {
    const urls = ['', 'cabinet/', 'list/', ...exhibits.map(i => `e/${i.exhibit.slug}/`)];
    await writePage('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(abs(u))}</loc></url>`).join('\n')}\n</urlset>\n`);
  }
  if (S.customDomain) await writePage('CNAME', S.customDomain + '\n');
  await writePage('.nojekyll', '');
  return { pages: 3 + exhibits.length, items: data.items.filter(i => !i.off).length, version: V };
}
