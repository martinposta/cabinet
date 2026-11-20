// End-to-end tests: the real admin server against a throw-away data root. `npm test`

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parseCube } from '../lib/look.mjs';
import { diffCabinet } from '../lib/changes.mjs';
import { execFileSync } from 'node:child_process';
import { looksLikeFileName, hasCitationMarks, exifHasGps, contentFindings } from '../lib/release-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4399;
const BASE = `http://localhost:${PORT}`;
let tmp, server;
const sleep = ms => new Promise(r => setTimeout(r, ms));

before(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kabinet-test-'));
  // an identity LUT (2×2×2) in the test inbox, for the LUT path of the pipeline
  await fs.mkdir(path.join(tmp, 'assets-inbox', 'looks'), { recursive: true });
  const id = [];
  for (let b = 0; b < 2; b++) for (let g = 0; g < 2; g++) for (let r = 0; r < 2; r++) id.push(`${r} ${g} ${b}`);
  await fs.writeFile(path.join(tmp, 'assets-inbox', 'looks', 'identity.cube'), `TITLE "id"\nLUT_3D_SIZE 2\n${id.join('\n')}\n`);
  server = spawn(process.execPath, ['admin/server.mjs'], {
    cwd: ROOT, stdio: 'ignore',
    env: { ...process.env, KABINET_DATA_ROOT: tmp, PORT: String(PORT), NO_OPEN: '1' },
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/state'); return; } catch { await sleep(100); }
  }
  throw new Error('admin did not start');
});

after(async () => {
  server?.kill();
  await fs.rm(tmp, { recursive: true, force: true });
});

test('state loads data/cabinet.json', async () => {
  const { data } = await (await fetch(BASE + '/api/state')).json();
  assert.equal(data.version, 1);
  assert.ok(Array.isArray(data.items));
  const file = JSON.parse(await fs.readFile(path.join(tmp, 'data', 'cabinet.json'), 'utf8'));
  assert.equal(file.settings.customDomain, 'cabinet.martinposta.com');
});

test('preview renders the wall template at cabinet/: tokens filled, relative URLs, English', async () => {
  const html = await (await fetch(BASE + '/preview/cabinet/')).text();
  assert.doesNotMatch(html, /\{\{\w+\}\}/);
  assert.match(html, /<html lang="en" data-exhibit="">/);
  assert.match(html, /<title>Cabinet of Curiosities<\/title>/);
  assert.match(html, /<base href="\.\.\/">/);
  assert.match(html, /<script type="module" src="js\/main\.js\?v=[0-9a-f]{10}">/);
  assert.match(html, /<a href="list\/">/, 'noscript links the list');
  // invariant: no absolute /… paths in the public site
  assert.doesNotMatch(html, /(src|href)="\/(?!\/)/);
  for (const f of ['css/cabinet.css', 'js/main.js', 'js/wall.js', 'js/camera.js', 'js/viewer.js', 'js/placeholders.js', 'js/util.js', 'js/doors.js', 'js/shadows.js', 'js/cursor.js', 'favicon.svg']) {
    assert.equal((await fetch(BASE + '/preview/' + f)).status, 200, f);
  }
  for (const f of ['wall.html', 'doors.html', 'list.html']) assert.equal((await fetch(BASE + '/preview/' + f)).status, 404, `template ${f} is not published`);
});

test('data.json is the public projection of cabinet.json', async () => {
  const pub = await (await fetch(BASE + '/preview/data.json')).json();
  assert.deepEqual(Object.keys(pub).sort(), ['cabinet', 'handCandle', 'items', 'media', 'nameplate', 'notices', 'plates', 'room', 'settings', 'surround', 'view', 'wall']);
  assert.deepEqual(Object.keys(pub.settings).sort(), ['fx', 'plateSubtitle', 'plateTitle']);
  assert.deepEqual(pub.settings.fx, { darkness: true, castShadows: true, frameLips: true, roomCandleShadows: true, handCandle: true });
});

test('the layout is data: no spiral left in the site code', async () => {
  for (const f of await fs.readdir(path.join(ROOT, 'site', 'js'))) {
    const src = await fs.readFile(path.join(ROOT, 'site', 'js', f), 'utf8');
    assert.doesNotMatch(src, /function layout\(/, f);
  }
});

test('the frozen layout in the repo is complete', async () => {
  const d = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'cabinet.json'), 'utf8'));
  const ids = d.items.map(i => i.id);
  assert.equal(new Set(ids).size, ids.length, 'ids unique');
  const ex = d.items.filter(i => i.exhibit);
  // unique and positive; gaps are fine – removing an exhibit must not renumber the others
  const invs = ex.map(i => i.exhibit.inv);
  assert.equal(new Set(invs).size, invs.length, 'inventory numbers unique');
  assert.ok(invs.every(n => Number.isInteger(n) && n > 0), 'inventory numbers positive');
  for (const i of d.items) {
    if (i.drawer != null) assert.ok(i.dx >= 0 && i.dx <= 1 && i.dy >= 0 && i.dy <= 1, i.id);
    else assert.ok(Number.isFinite(i.x) && Number.isFinite(i.y), i.id);
  }
});

test('docs has CNAME and .nojekyll', async () => {
  assert.equal((await fs.readFile(path.join(tmp, 'docs', 'CNAME'), 'utf8')).trim(), 'cabinet.martinposta.com');
  await fs.access(path.join(tmp, 'docs', '.nojekyll'));
});

test('admin refuses foreign hosts and origins', async () => {
  const status = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/api/state', headers: { Host: 'evil.example' } }, r => { r.resume(); resolve(r.statusCode); }).on('error', reject);
  });
  assert.equal(status, 403);
  const post = await fetch(BASE + '/api/rebuild', { method: 'POST', headers: { Origin: 'http://evil.example' } });
  assert.equal(post.status, 403);
});

test('preview cannot escape docs/', async () => {
  const res = await fetch(BASE + '/preview/..%2Fpackage.json');
  assert.notEqual(res.status, 200);
});

// ---------- phase 2: media pipeline ----------

const HEADERS = { Origin: BASE };
async function call(method, p, body, raw) {
  const opts = { method, headers: { ...HEADERS } };
  if (raw) opts.body = raw;
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
  const res = await fetch(BASE + p, opts);
  const t = await res.text();
  let json; try { json = JSON.parse(t); } catch { json = t; }
  return { status: res.status, json };
}
const settle = () => new Promise(r => setTimeout(r, 450)).then(() => fetch(BASE + '/api/state'));

// A cut-out: transparent canvas with an opaque gradient square, carrying GPS EXIF that must not survive.
const cutout = (seed = 0) => sharp({ create: { width: 900, height: 700, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500"><defs><linearGradient id="g"><stop offset="0" stop-color="#8a5a${(20 + seed).toString(16)}"/><stop offset="1" stop-color="#d9c08a"/></linearGradient></defs><rect width="600" height="500" fill="url(#g)"/></svg>`), left: 150, top: 100 }])
  .withExif({ IFD0: { Artist: 'Someone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '50/1 5/1 0/1' } })
  .png().toBuffer();
const opaque = (w, h, color = '#3a6a4a') => sharp({ create: { width: w, height: h, channels: 3, background: color } }).jpeg().toBuffer();
const meanRGB = async file => (await sharp(file).stats()).channels.slice(0, 3).map(c => c.mean);

let itemId, tileId;

test('import: cut-out keeps alpha, gets its widths, no metadata, original kept', async () => {
  const r = await call('POST', '/api/media?name=frame.png&kind=item', undefined, await cutout());
  assert.equal(r.status, 200, JSON.stringify(r.json));
  itemId = r.json.id;
  const m = r.json.media;
  assert.equal(m.kind, 'item'); assert.equal(m.alpha, true); assert.equal(m.w, 900); assert.equal(m.h, 700);
  assert.deepEqual(m.widths, [640, 900]);
  assert.equal(r.json.warning, '');
  for (const w of m.widths) {
    const f = path.join(tmp, 'docs', 'media', itemId, `${w}.webp`);
    const meta = await sharp(f).metadata();
    assert.equal(meta.hasAlpha, true);
    assert.equal(meta.exif, undefined, 'no EXIF (and so no GPS) in published files');
  }
  const orig = await fs.readdir(path.join(tmp, 'assets-inbox', '_imported'));
  assert.deepEqual(orig, [itemId + '.png']);
  const again = await call('POST', '/api/media?name=frame-copy.png&kind=item', undefined, await cutout());
  assert.equal(again.json.duplicate, true);
});

test('import: an opaque image drops its alpha channel; kinds cap the size', async () => {
  const r = await call('POST', '/api/media?name=tile.jpg&kind=tile', undefined, await opaque(3000, 3000));
  assert.equal(r.status, 200, JSON.stringify(r.json));
  tileId = r.json.id;
  assert.equal(r.json.media.alpha, false);
  assert.deepEqual(r.json.media.widths, [2048]);
  assert.equal((await sharp(path.join(tmp, 'docs', 'media', tileId, '2048.webp')).metadata()).hasAlpha, false);
});

test('looks: a preset changes the pixels, re-applying bumps the version, identity LUT keeps them', async () => {
  const before = await meanRGB(path.join(tmp, 'docs', 'media', itemId, '640.webp'));
  const r = await call('POST', `/api/media/${itemId}/look`, { look: 'cold-night' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.media.v, 2); assert.equal(r.json.media.look, 'cold-night');
  const after = await meanRGB(path.join(tmp, 'docs', 'media', itemId, '640.webp'));
  assert.ok(after[2] / after[0] > before[2] / before[0], 'cold look shifts towards blue');
  const lut = await call('POST', `/api/media/${itemId}/look`, { look: 'lut:identity.cube' });
  assert.equal(lut.status, 200, JSON.stringify(lut.json));
  const id = await meanRGB(path.join(tmp, 'docs', 'media', itemId, '640.webp'));
  before.forEach((v, i) => assert.ok(Math.abs(v - id[i]) < 2, `identity LUT keeps channel ${i}`));
  assert.equal((await call('POST', `/api/media/${itemId}/look`, { look: 'nope' })).status, 400);
});

test('look preview returns a JPEG and stores nothing', async () => {
  const res = await fetch(BASE + '/api/look-preview?look=night-oil', { method: 'POST', headers: HEADERS, body: await cutout(3) });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');
  const { data } = await (await fetch(BASE + '/api/state')).json();
  assert.equal(Object.keys(data.media).length, 2);
});

test('roles check the kind; wall, cabinet and items validate their input', async () => {
  assert.equal((await call('POST', '/api/roles', { role: 'wallpaper', media: itemId })).status, 400);
  assert.equal((await call('POST', '/api/roles', { role: 'wallpaper', media: tileId })).status, 200);
  assert.equal((await call('PATCH', '/api/wall', { tileWorld: 'abc' })).status, 400);
  assert.equal((await call('PATCH', '/api/cabinet', { drawers: [{ x: 10, y: 10, w: 5, h: 100 }] })).status, 400);
  assert.equal((await call('POST', '/api/media?name=x.gif&kind=item', undefined, Buffer.from('GIF89a'))).status, 400);
  assert.equal((await call('POST', '/api/media?name=x.png&kind=bogus', undefined, await cutout(5))).status, 400);
  const bad = await fetch(BASE + '/api/wall', { method: 'PATCH', headers: HEADERS, body: '{oops' });
  assert.equal(bad.status, 400);
});

test('items: hang a real image, used media cannot be deleted, data.json carries media', async () => {
  const add = await call('POST', '/api/items', { media: itemId, x: 900, y: 10, w: 420, rotation: 1.5 });
  assert.equal(add.status, 200, JSON.stringify(add.json));
  const id = add.json.item.id;
  assert.equal((await call('POST', '/api/items', { media: tileId })).status, 400, 'only item-kind media can hang');
  const del = await call('DELETE', `/api/media/${itemId}`);
  assert.equal(del.status, 400); assert.match(del.json.error, /používá/);
  const ex = await call('PATCH', `/api/items/${id}`, { exhibit: { title: 'Test', slug: 'Bad Slug' } });
  assert.equal(ex.status, 400);
  assert.equal((await call('PATCH', `/api/items/${id}`, { exhibit: { title: 'Test', slug: 'test-piece' } })).json.item.exhibit.inv, 1);
  await settle();
  const pub = await (await fetch(BASE + '/preview/data.json')).json();
  assert.equal(pub.items[0].media, itemId);
  assert.equal(pub.media[itemId].kind, 'item');
  assert.equal(pub.wall.wallpaper, tileId);
  assert.equal((await call('DELETE', `/api/items/${id}`)).status, 200);
  assert.equal((await call('DELETE', `/api/media/${itemId}`)).status, 200);
  await settle();
  await assert.rejects(fs.access(path.join(tmp, 'docs', 'media', itemId)));
  assert.deepEqual(await fs.readdir(path.join(tmp, 'assets-inbox', '_imported')), [tileId + '.jpg']);
  await fs.access(path.join(tmp, 'docs', 'media', tileId, '2048.webp')); // a rebuild keeps media
});

test('parseCube reads sizes and domains and rejects broken files', () => {
  const c = parseCube('# c\nLUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n' + '0 0 0\n'.repeat(8));
  assert.equal(c.size, 2); assert.equal(c.table.length, 24);
  assert.throws(() => parseCube('LUT_3D_SIZE 2\n0 0 0\n'));
  assert.throws(() => parseCube('LUT_1D_SIZE 16\n'));
});

// ---------- phase 3: the wall editor saves the whole layout ----------

test('layout: replaces items and nameplate, validates every field', async () => {
  const img = await call('POST', '/api/media?name=piece.png&kind=item', undefined, await cutout(9));
  const mid = img.json.id;
  const ph = { paint: 'art', name: 'botanical', seed: 229, w: 150, h: 190, frame: { shape: 'rect', mat: 'walnut', fw: 14 } };
  const good = [
    { id: 'centre', media: mid, x: 0, y: 0, w: 500, rotation: -0.5, opening: { shape: 'oval', x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
      exhibit: { slug: 'centre', inv: 1, title: 'Centre', tags: [' a ', ''], gallery: [], captions: {} } },
    { id: 'botanical-1', placeholder: ph, x: -400, y: 10, rotation: 0.2 },
    { id: 'on-top', media: mid, x: 50, y: 900, w: 80, on: 'cabinet' },
    { id: 'hidden', media: mid, w: 90, drawer: 1, dx: 0.3, dy: 0.5, x: 999 },
  ];
  const r = await call('PUT', '/api/layout', { items: good, nameplate: { x: 10, y: -300 } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.items.map(i => i.id), ['centre', 'botanical-1', 'on-top', 'hidden']);
  assert.deepEqual(r.json.items[0].exhibit.tags, ['a']);
  assert.equal(r.json.items[3].x, undefined, 'a drawer item has no wall position');
  assert.equal(r.json.nameplate.x, 10);

  const bad = async (items, re) => {
    const res = await call('PUT', '/api/layout', { items });
    assert.equal(res.status, 400, JSON.stringify(items).slice(0, 80));
    if (re) assert.match(res.json.error, re);
  };
  await bad([good[1], { ...good[1] }], /dvakrát/);
  await bad([{ id: 'x', placeholder: { ...ph, name: 'alert(1)' }, x: 0, y: 0 }], /zástupná/);
  await bad([{ id: 'Bad Id', media: mid, x: 0, y: 0, w: 10 }], /ID/);
  await bad([{ id: 'x', media: mid, x: 0, y: 0 }], /šířka/);
  await bad([{ id: 'x', media: mid, x: 0, y: 0, w: 10, opening: { shape: 'rect', x: 0.5, y: 0, w: 0.8, h: 0.5 } }], /přesahuje/);
  await bad([{ ...good[0] }, { id: 'y', media: mid, x: 0, y: 0, w: 10, exhibit: { slug: 'other', inv: 1, title: 'Y' } }], /Inventární číslo 1/);
  await bad([{ ...good[0] }, { id: 'y', media: mid, x: 0, y: 0, w: 10, exhibit: { slug: 'centre', title: 'Y' } }], /Adresu/);
  await bad([{ id: 'x', media: mid, x: 0, y: 0, w: 10, exhibit: { slug: 'x', title: 'X', gallery: ['nope00000000'] } }], /galerie/i);
  // a failed save changes nothing
  const { data } = await (await fetch(BASE + '/api/state')).json();
  assert.deepEqual(data.items.map(i => i.id), ['centre', 'botanical-1', 'on-top', 'hidden']);
});

test('editor page is served and the public data carries what the editor wrote', async () => {
  // the wall editor is section Stěna of the one admin page since phase 3b; /editor redirects there
  const ed = await fetch(BASE + '/editor', { redirect: 'manual' });
  assert.equal(ed.status, 302);
  assert.equal(ed.headers.get('location'), '/#stena');
  assert.equal((await fetch(BASE + '/')).status, 200);
  await settle();
  const pub = await (await fetch(BASE + '/preview/data.json')).json();
  assert.equal(pub.items[0].opening.shape, 'oval');
  assert.equal(pub.nameplate.y, -300);
});

// ---------- phase 4 / 4b: pages, doors, SEO ----------

test('pages: doors at the root, exhibit pages with their own tags, list, sitemap, robots, 404', async () => {
  await settle();
  const doors = await (await fetch(BASE + '/preview/')).text();
  assert.match(doors, /aria-label="Enter the cabinet"/);
  assert.match(doors, /<svg viewBox="0 0 480 640"/, 'painted stand-in until there are photos');
  assert.match(doors, /<link rel="prefetch" href="cabinet\/">/);
  assert.doesNotMatch(doors, /main\.js/, 'no wall code on the doors page');
  assert.match(doors, /<link rel="canonical" href="https:\/\/cabinet\.martinposta\.com\/">/);

  const ex = await (await fetch(BASE + '/preview/e/centre/')).text();
  assert.match(ex, /data-exhibit="centre"/);
  assert.match(ex, /<base href="\.\.\/\.\.\/">/);
  assert.match(ex, /<title>Centre · Cabinet of Curiosities<\/title>/);
  assert.match(ex, /og:url" content="https:\/\/cabinet\.martinposta\.com\/e\/centre\/"/);
  assert.match(ex, /og:image" content="https:\/\/cabinet\.martinposta\.com\/media\/\w+\/og\.jpg\?v=1"/, 'an item cut-out makes a preview image');

  const list = await (await fetch(BASE + '/preview/list/')).text();
  assert.match(list, /<a href="e\/centre\/">Centre<\/a>/);
  assert.match(list, /inv\. no\. 001/);

  const sitemap = await (await fetch(BASE + '/preview/sitemap.xml')).text();
  for (const u of ['', 'cabinet/', 'list/', 'e/centre/']) assert.match(sitemap, new RegExp(`<loc>https://cabinet\\.martinposta\\.com/${u.replace(/\//g, '\\/')}</loc>`));
  assert.match(await (await fetch(BASE + '/preview/robots.txt')).text(), /Sitemap: https:\/\/cabinet\.martinposta\.com\/sitemap\.xml/);
  const nf = await fetch(BASE + '/preview/nothing/here/');
  assert.equal(nf.status, 404);
  assert.match(await nf.text(), /href="https:\/\/cabinet\.martinposta\.com\/"/);
});

test('settings validate; analytics only with a token; doors take photos and a sound', async () => {
  assert.equal((await call('PATCH', '/api/settings', { siteUrl: 'cabinet.martinposta.com' })).status, 400);
  assert.equal((await call('PATCH', '/api/settings', { analyticsToken: 'nope' })).status, 400);
  assert.equal((await call('PATCH', '/api/settings', { customDomain: 'https://x.com/' })).status, 400);
  const ok = await call('PATCH', '/api/settings', { plateTitle: 'Test Cabinet', analyticsToken: 'a'.repeat(32) });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  // sounds: published as uploaded
  assert.equal((await call('POST', '/api/sound?name=creak.flac', undefined, Buffer.from('x'))).status, 400);
  const snd = await call('POST', '/api/sound?name=creak.mp3', undefined, Buffer.from('ID3fake-mp3-bytes'));
  assert.equal(snd.status, 200, JSON.stringify(snd.json));
  assert.equal((await call('POST', '/api/roles', { role: 'doorsClosed', media: snd.json.id })).status, 400, 'a sound is not a door photo');
  assert.equal((await call('POST', '/api/roles', { role: 'doorsSound', media: snd.json.id })).status, 200);
  const photo = await call('POST', '/api/media?name=doors.jpg&kind=doors', undefined, await opaque(1800, 2400, '#3c2410'));
  assert.equal((await call('POST', '/api/roles', { role: 'doorsClosed', media: photo.json.id })).status, 200);
  assert.equal((await call('POST', '/api/roles', { role: 'doorsAjar', media: photo.json.id })).status, 200);
  await settle();
  const doors = await (await fetch(BASE + '/preview/')).text();
  assert.match(doors, /<title>Test Cabinet<\/title>/);
  assert.match(doors, /alt="Closed cabinet doors"/);
  assert.match(doors, new RegExp(`"sound":"media/${snd.json.id}/sound\\.mp3\\?v=1"`));
  assert.match(doors, /static\.cloudflareinsights\.com/);
  assert.match(doors, /localhost\|127/, 'the loader skips localhost');
  assert.equal((await fetch(BASE + `/preview/media/${snd.json.id}/sound.mp3`)).status, 200);
  const del = await call('DELETE', `/api/media/${snd.json.id}`);
  assert.equal(del.status, 400); assert.match(del.json.error, /vrznutí/);
  await call('PATCH', '/api/settings', { plateTitle: 'Cabinet of Curiosities', analyticsToken: '' });
});

test('layout saves are refused when the data changed since the editor loaded it', async () => {
  const { data, rev } = await (await fetch(BASE + '/api/state')).json();
  const first = await call('PUT', '/api/layout', { items: data.items, nameplate: { ...data.nameplate, x: 1 }, rev });
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.notEqual(first.json.rev, rev);
  const stale = await call('PUT', '/api/layout', { items: [], nameplate: data.nameplate, rev });
  assert.equal(stale.status, 409);
  assert.match(stale.json.error, /změnilo jinde/);
  const after = await (await fetch(BASE + '/api/state')).json();
  assert.equal(after.data.items.length, data.items.length, 'nothing was overwritten');
});

test('an exhibit taken off the wall is kept (off) with its texts but never published', async () => {
  const img = await call('POST', '/api/media?name=stored.png&kind=item', undefined, await cutout(41));
  const it = await call('POST', '/api/items', { media: img.json.id, x: 0, y: 0, w: 200, exhibit: { slug: 'stored-one', title: 'Stored One', description: 'Kept text' } });
  assert.equal(it.status, 200, JSON.stringify(it.json));
  let { data, rev } = await (await fetch(BASE + '/api/state')).json();
  const items = data.items.map(i => i.id === it.json.item.id ? { ...i, off: true } : i);
  const put = await call('PUT', '/api/layout', { items, nameplate: data.nameplate, rev });
  assert.equal(put.status, 200, JSON.stringify(put.json));
  await settle();
  ({ data } = await (await fetch(BASE + '/api/state')).json());
  const kept = data.items.find(i => i.id === it.json.item.id);
  assert.equal(kept.off, true);
  assert.equal(kept.exhibit.description, 'Kept text', 'texts survive');
  const pub = await (await fetch(BASE + '/preview/data.json')).json();
  assert.ok(!pub.items.some(i => i.id === kept.id), 'not on the public wall');
  assert.equal((await fetch(BASE + '/preview/e/stored-one/')).status, 404, 'no exhibit page');
  assert.doesNotMatch(await (await fetch(BASE + '/preview/list/')).text(), /Stored One/);
  assert.equal((await call('DELETE', `/api/media/${img.json.id}`)).status, 400, 'its picture is still in use');
  ({ rev } = await (await fetch(BASE + '/api/state')).json());
  const back = await call('PUT', '/api/layout', { items: data.items.map(i => i.id === kept.id ? { ...i, off: false } : i), nameplate: data.nameplate, rev });
  assert.equal(back.status, 200);
  assert.equal(back.json.items.find(i => i.id === kept.id).off, undefined, 'rehung');
});

test('room size: saved with the layout, published, too narrow refused, null = grows with content', async () => {
  let { data, rev } = await (await fetch(BASE + '/api/state')).json();
  const narrow = await call('PUT', '/api/layout', { items: data.items, nameplate: data.nameplate, room: { x0: 0, x1: 100, y0: -500 }, rev });
  assert.equal(narrow.status, 400);
  const ok = await call('PUT', '/api/layout', { items: data.items, nameplate: data.nameplate, room: { x0: -1500, x1: 1500, y0: -900 }, rev });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.deepEqual(ok.json.room, { x0: -1500, x1: 1500, y0: -900 });
  await settle();
  assert.deepEqual((await (await fetch(BASE + '/preview/data.json')).json()).room, { x0: -1500, x1: 1500, y0: -900 });
  const back = await call('PUT', '/api/layout', { items: data.items, nameplate: data.nameplate, room: null, rev: ok.json.rev });
  assert.equal(back.status, 200);
  assert.equal(back.json.room, null);
});

test('room surround: surround images only, sizes validated, published, in use', async () => {
  const wrong = await call('POST', '/api/media?name=frame.png&kind=item', undefined, await cutout(51));
  assert.equal((await call('PATCH', '/api/surround', { cornice: wrong.json.id })).status, 400, 'only a „surround“ image');
  const side = await call('POST', '/api/media?name=side.png&kind=surround', undefined, await cutout(52));
  assert.equal(side.status, 200, JSON.stringify(side.json));
  assert.equal((await call('PATCH', '/api/surround', { sideW: 5 })).status, 400);
  assert.equal((await call('PATCH', '/api/surround', { nope: 1 })).status, 400);
  const ok = await call('PATCH', '/api/surround', { on: true, sideMid: side.json.id, sideW: 300 });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.surround.wainscotH, 420, 'the rest keeps its defaults');
  await settle();
  const pub = await (await fetch(BASE + '/preview/data.json')).json();
  assert.equal(pub.surround.sideMid, side.json.id);
  assert.equal(pub.surround.on, true);
  assert.equal((await call('DELETE', `/api/media/${side.json.id}`)).status, 400, 'in use by the surround');
  await call('PATCH', '/api/surround', { on: false, sideMid: null });
});

test('rotation: any angle lying in a drawer, at most ±45° on the wall', async () => {
  const img = await call('POST', '/api/media?name=coin.png&kind=item', undefined, await cutout(61));
  let { data, rev } = await (await fetch(BASE + '/api/state')).json();
  const wall = { id: 'tilt-test', media: img.json.id, x: 0, y: 0, w: 120, rotation: 60 };
  const bad = await call('PUT', '/api/layout', { items: [...data.items, wall], nameplate: data.nameplate, rev });
  assert.equal(bad.status, 400, 'a picture on the wall cannot lean 60°');
  const drawer = { id: 'tilt-test', media: img.json.id, w: 120, rotation: 120, drawer: 0, dx: 0.5, dy: 0.5 };
  const ok = await call('PUT', '/api/layout', { items: [...data.items, drawer], nameplate: data.nameplate, rev });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.items.find(i => i.id === 'tilt-test').rotation, 120);
  await call('PUT', '/api/layout', { items: data.items, nameplate: data.nameplate, rev: ok.json.rev });
});

test('bookcase shelves on the image; things stand on a hung item and lose it when it is gone', async () => {
  const bc = await call('POST', '/api/media?name=bookcase.png&kind=item', undefined, await cutout(71));
  const bad = await call('PATCH', `/api/media/${bc.json.id}`, { shelves: [{ x: 0.1, y: 0.2, w: 2, h: 0.2 }] });
  assert.equal(bad.status, 400);
  const ok = await call('PATCH', `/api/media/${bc.json.id}`, { shelves: [{ x: 0.1, y: 0.1, w: 0.8, h: 0.3 }, { x: 0.1, y: 0.5, w: 0.8, h: 0.3 }] });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.media.shelves.length, 2);
  let { data, rev } = await (await fetch(BASE + '/api/state')).json();
  const host = { id: 'bookcase-t', media: bc.json.id, x: 0, y: 0, w: 300 };
  const thing = { id: 'thing-t', media: bc.json.id, x: 0, y: -20, w: 60, sits: 'bookcase-t' };
  const put = await call('PUT', '/api/layout', { items: [...data.items, host, thing], nameplate: data.nameplate, rev });
  assert.equal(put.status, 200, JSON.stringify(put.json));
  assert.equal(put.json.items.find(i => i.id === 'thing-t').sits, 'bookcase-t');
  const gone = await call('PUT', '/api/layout', { items: [...data.items, thing], nameplate: data.nameplate, rev: put.json.rev });
  assert.equal(gone.status, 200);
  assert.equal(gone.json.items.find(i => i.id === 'thing-t').sits, undefined, 'its bookcase is gone, it stands on nothing');
  await call('PUT', '/api/layout', { items: data.items, nameplate: data.nameplate, rev: gone.json.rev });
});

test('plaqueAt: the plaque\'s own offset from the exhibit – rounded, limited, 0/0 = not moved, kept by a layout save', async () => {
  const img = await call('POST', '/api/media?name=plaque-at.png&kind=item', undefined, await cutout(97));
  let { data, rev } = await (await fetch(BASE + '/api/state')).json();
  const base = { id: 'plaque-at-t', media: img.json.id, x: 0, y: 0, w: 200 };
  const put = (item, r) => call('PUT', '/api/layout', { items: [...data.items, item], nameplate: data.nameplate, rev: r });

  const bad = await put({ ...base, plaqueAt: { dx: 99999, dy: 0 } }, rev);
  assert.equal(bad.status, 400, 'a plaque cannot leave the room');
  const nan = await put({ ...base, plaqueAt: { dx: 'abc', dy: 0 } }, rev);
  assert.equal(nan.status, 400);

  const ok = await put({ ...base, plaqueAt: { dx: 30.126, dy: -12 } }, rev);
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.deepEqual(ok.json.items.find(i => i.id === 'plaque-at-t').plaqueAt, { dx: 30.1, dy: -12 }, 'rounded to a tenth');

  // saved with the item and carried through the next layout save untouched
  const again = await put(ok.json.items.find(i => i.id === 'plaque-at-t'), ok.json.rev);
  assert.equal(again.status, 200);
  assert.deepEqual(again.json.items.find(i => i.id === 'plaque-at-t').plaqueAt, { dx: 30.1, dy: -12 });

  // 0 / 0 (or null) means "not moved": the field disappears instead of being stored
  const zero = await put({ ...base, plaqueAt: { dx: 0, dy: 0 } }, again.json.rev);
  assert.equal(zero.json.items.find(i => i.id === 'plaque-at-t').plaqueAt, undefined);
  const none = await put({ ...base, plaqueAt: null }, zero.json.rev);
  assert.equal(none.json.items.find(i => i.id === 'plaque-at-t').plaqueAt, undefined);

  // single-item PATCH uses the same validation
  const patch = await call('PATCH', '/api/items/plaque-at-t', { plaqueAt: { dx: 5, dy: 7 } });
  assert.notEqual(patch.status, 400, JSON.stringify(patch.json));
  await call('PUT', '/api/layout', { items: data.items, nameplate: data.nameplate, rev: (await (await fetch(BASE + '/api/state')).json()).rev });
});

test('door casing: shown only with a picture and its opening drawn', async () => {
  const fr = await call('POST', '/api/media?name=casing.png&kind=doors', undefined, await cutout(81));
  assert.equal((await call('POST', '/api/roles', { role: 'doorsFrame', media: fr.json.id })).status, 200);
  await settle();
  assert.doesNotMatch(await (await fetch(BASE + '/preview/')).text(), /class="portal"/, 'no opening yet, no casing');
  assert.equal((await call('PATCH', '/api/doors', { frameOpening: { x: 0.5, y: 0.1, w: 0.8, h: 0.8 } })).status, 400, 'past the picture');
  assert.equal((await call('PATCH', '/api/doors', { frameOpening: { x: 0.2, y: 0.15, w: 0.6, h: 0.85 } })).status, 200);
  await settle();
  const html = await (await fetch(BASE + '/preview/')).text();
  assert.match(html, /class="portal" style="--ar:[\d.]+\/[\d.]+;--ox:20\.000%;--oy:15\.000%;--ow:60\.000%;--oh:85\.000%"/);
  assert.match(html, new RegExp(`class="casing" src="media/${fr.json.id}/`));
  assert.equal((await call('DELETE', `/api/media/${fr.json.id}`)).status, 400, 'the casing is in use');
  await call('POST', '/api/roles', { role: 'doorsFrame', media: null });
  await call('PATCH', '/api/doors', { frameOpening: null });
});

test('author and other sites: rel=me and schema.org on every page, bad addresses refused', async () => {
  assert.equal((await call('PATCH', '/api/settings', { authorLinks: 'martinposta.com' })).status, 400, 'not a full address');
  const ok = await call('PATCH', '/api/settings', { authorName: 'Test Author', authorLinks: 'https://example.com/\nhttps://foto.example.com/' });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.deepEqual(ok.json.settings.authorLinks, ['https://example.com/', 'https://foto.example.com/']);
  await settle();
  const html = await (await fetch(BASE + '/preview/cabinet/')).text();
  assert.match(html, /<link rel="me" href="https:\/\/foto\.example\.com\/">/);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  const person = ld['@graph'].find(n => n['@type'] === 'Person');
  assert.equal(person.name, 'Test Author');
  assert.deepEqual(person.sameAs, ['https://example.com/', 'https://foto.example.com/']);
  assert.doesNotMatch(await (await fetch(BASE + '/preview/sitemap.xml')).text(), /example\.com/, 'the sitemap lists only this site');
  await call('PATCH', '/api/settings', { authorName: '', authorLinks: '' });
});

test('notices: timeline newest first, one board at most, a copy beside the doors only while it hangs', async () => {
  assert.equal((await call('POST', '/api/notices', { date: '2026-13-40', text: 'x' })).status, 400, 'bad date');
  const a = await call('POST', '/api/notices', { date: '2026-11-01', text: 'Older one' });
  const b = await call('POST', '/api/notices', { date: '2026-11-20', text: 'Newer one\nSecond paragraph' });
  const empty = await call('POST', '/api/notices', { date: '2026-11-21', text: '' });
  assert.equal(b.status, 200, JSON.stringify(b.json));
  await settle();
  let pub = await (await fetch(BASE + '/preview/data.json')).json();
  assert.deepEqual(pub.notices.map(n => n.text.split('\n')[0]), ['Newer one', 'Older one'], 'newest first, the empty one left out');
  const check = await call('GET', '/api/preflight');
  assert.ok(check.json.content.some(f => f.area === 'Aktuality' && f.level === 'error'), 'an empty notice is a content error');
  assert.equal((await call('DELETE', `/api/notices/${empty.json.notice.id}`)).status, 200);
  assert.equal((await call('PATCH', `/api/notices/${a.json.notice.id}`, { date: '2026-11-25' })).status, 200);

  // the board: an ordinary hung item marked opens:"notices"
  const img = await call('POST', '/api/media?name=slate.png&kind=item', undefined, await cutout(91));
  let { data, rev } = await (await fetch(BASE + '/api/state')).json();
  const board = { id: 'board-t', media: img.json.id, x: 0, y: 0, w: 200, opens: 'notices' };
  const two = await call('PUT', '/api/layout', { items: [...data.items, board, { ...board, id: 'board-u' }], nameplate: data.nameplate, rev });
  assert.equal(two.status, 400, 'one board at most');
  const asExhibit = await call('PUT', '/api/layout', { items: [...data.items, { ...board, exhibit: { slug: 'slate', title: 'Slate', description: 'x' } }], nameplate: data.nameplate, rev });
  assert.equal(asExhibit.status, 400, 'never an exhibit');
  const hung = await call('PUT', '/api/layout', { items: [...data.items, board], nameplate: data.nameplate, rev });
  assert.equal(hung.status, 200, JSON.stringify(hung.json));
  await settle();
  let doors = await (await fetch(BASE + '/preview/')).text();
  assert.match(doors, /id="nbDoors"/, 'a copy beside the doors');
  assert.match(doors, /"notices":\[\{"id":"[0-9a-f]+","date":"2026-11-25","text":"Older one"\}/, 'notices written into the doors page, newest first');
  pub = await (await fetch(BASE + '/preview/data.json')).json();
  assert.equal(pub.items.find(i => i.id === 'board-t')?.opens, 'notices');
  // taken off the wall: gone from the doors too
  const off = await call('PUT', '/api/layout', { items: [...data.items, { ...board, off: true }], nameplate: data.nameplate, rev: hung.json.rev });
  assert.equal(off.status, 200);
  await settle();
  doors = await (await fetch(BASE + '/preview/')).text();
  assert.doesNotMatch(doors, /id="nbDoors"/, 'no copy while the board is off the wall');
  await call('PUT', '/api/layout', { items: data.items, nameplate: data.nameplate, rev: off.json.rev });
  for (const n of [a, b]) await call('DELETE', `/api/notices/${n.json.notice.id}`);
});

test('effect switches and the hand candle', async () => {
  assert.equal((await call('PATCH', '/api/settings', { fx: { castShadows: false } })).status, 200);
  const { data } = await (await fetch(BASE + '/api/state')).json();
  assert.deepEqual(data.settings.fx, { darkness: true, castShadows: false, frameLips: true, roomCandleShadows: true, handCandle: true });
  const img = await call('POST', '/api/media?name=candle.png&kind=item', undefined, await cutout(11));
  assert.equal((await call('PUT', '/api/hand-candle', { media: img.json.id, fx: 2 })).status, 400);
  const ok = await call('PUT', '/api/hand-candle', { media: img.json.id, fx: 0.5, fy: 0.1, height: 90 });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  await settle();
  const pub = await (await fetch(BASE + '/preview/data.json')).json();
  assert.equal(pub.settings.fx.castShadows, false);
  assert.equal(pub.handCandle.media, img.json.id);
  // small enough (≤ 128 px) to be a real system cursor, which never trails the mouse
  assert.match(pub.handCandle.cursor?.x1 || '', new RegExp(`^media/${img.json.id}/cursor-90-v1-1x\\.png$`));
  assert.equal((await fetch(BASE + '/preview/' + pub.handCandle.cursor.x2)).status, 200);
  assert.match(await (await fetch(BASE + '/preview/')).text(), new RegExp(`"candle":\\{"src":"media/${img.json.id}/`));
  assert.equal((await call('DELETE', `/api/media/${img.json.id}`)).status, 400, 'the candle is in use');
  await call('PATCH', '/api/settings', { fx: { castShadows: true } });
});

test('nameplate and plaque look: defaults, plate images only, validation, reset, in use', async () => {
  let pub = await (await fetch(BASE + '/preview/data.json')).json();
  assert.equal(pub.plates.nameplate.font, 'display', 'defaults are filled in for the site');
  assert.equal(pub.plates.plaque.media, null);
  const item = await call('POST', '/api/media?name=not-a-plate.png&kind=item', undefined, await cutout(31));
  assert.equal((await call('PATCH', '/api/plates', { plaque: { media: item.json.id } })).status, 400, 'only a „plate“ image');
  const plate = await call('POST', '/api/media?name=brass.png&kind=plate', undefined, await cutout(32));
  assert.equal(plate.status, 200, JSON.stringify(plate.json));
  assert.equal((await call('PATCH', '/api/plates', { nameplate: { color: 'red' } })).status, 400);
  assert.equal((await call('PATCH', '/api/plates', { nameplate: { font: 'comic' } })).status, 400);
  assert.equal((await call('PATCH', '/api/plates', { plaque: { nope: 1 } })).status, 400);
  const ok = await call('PATCH', '/api/plates', { nameplate: { media: plate.json.id, color: '#112233', size: 40 }, plaque: { media: plate.json.id, ends: 20 } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.plates.nameplate.subSize, 15, 'one field changes, the rest keep their values');
  await settle();
  pub = await (await fetch(BASE + '/preview/data.json')).json();
  assert.equal(pub.plates.nameplate.media, plate.json.id);
  assert.equal(pub.plates.plaque.ends, 20);
  assert.equal((await call('DELETE', `/api/media/${plate.json.id}`)).status, 400, 'the plate is in use');
  assert.equal((await call('PATCH', '/api/plates', { reset: true })).status, 200);
  const { data } = await (await fetch(BASE + '/api/state')).json();
  assert.equal(data.plates.nameplate.media, null);
  assert.equal(data.plates.nameplate.color, '#3b2707');
  assert.equal((await call('DELETE', `/api/media/${plate.json.id}`)).status, 200, 'free again after the reset');
});

test('replacing a media file keeps its id and every use, bumps the version', async () => {
  const a = await call('POST', '/api/media?name=old.png&kind=item', undefined, await cutout(21));
  const id = a.json.id;
  const hung = await call('POST', '/api/items', { media: id, x: 0, y: 0, w: 200 });
  const r = await call('POST', `/api/media/${id}/replace?name=new.png`, undefined, await cutout(22));
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.id, id);
  assert.equal(r.json.media.v, 2);
  assert.equal(r.json.media.name, 'new.png');
  const { data } = await (await fetch(BASE + '/api/state')).json();
  assert.equal(data.items.find(i => i.id === hung.json.item.id).media, id, 'the wall item still uses it');
  const orig = await fs.readdir(path.join(tmp, 'assets-inbox', '_imported'));
  assert.equal(orig.filter(f => f.startsWith(id)).length, 1, 'one original kept, the new one');
  // a file that is already another media item is refused
  const b = await call('POST', '/api/media?name=b.png&kind=item', undefined, await cutout(23));
  assert.equal((await call('POST', `/api/media/${id}/replace?name=b.png`, undefined, await cutout(23))).status, 400);
  await call('DELETE', `/api/items/${hung.json.item.id}`);
  await call('DELETE', `/api/media/${id}`); await call('DELETE', `/api/media/${b.json.id}`);
});

test('the page start (view) is part of the layout: saved, validated, public', async () => {
  const { data, rev } = await (await fetch(BASE + '/api/state')).json();
  const r = await call('PUT', '/api/layout', { items: data.items, nameplate: data.nameplate, view: { x: -72, y: 100 }, rev });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.view, { x: -72, y: 100 });
  assert.equal((await call('PUT', '/api/layout', { items: data.items, nameplate: data.nameplate, view: { x: 'a', y: 0 } })).status, 400);
  await settle();
  assert.deepEqual((await (await fetch(BASE + '/preview/data.json')).json()).view, { x: -72, y: 100 });
  const back = await call('PUT', '/api/layout', { items: data.items, nameplate: data.nameplate, view: null });
  assert.equal(back.json.view, null);
});

test('release check: helpers recognise file-name titles, pasted citations and GPS in EXIF', () => {
  assert.ok(looksLikeFileName('Dscf2810') && looksLikeFileName('IMG_4412') && looksLikeFileName(' dsc 0042 '));
  assert.ok(!looksLikeFileName('DL-44M') && !looksLikeFileName('World Map') && !looksLikeFileName(''));
  assert.ok(hasCitationMarks('the Algonquian languages,[10][11] the source') && hasCitationMarks('x [citation needed]'));
  assert.ok(!hasCitationMarks('Built in 1513 (see note) and [a] draft.'));
  // a minimal little-endian TIFF/EXIF block with one IFD0 entry: with the GPS pointer (0x8825) or without (0x010f make)
  const exif = tag => {
    const b = Buffer.alloc(6 + 8 + 2 + 12 + 4);
    b.write('Exif\0\0', 0, 'latin1'); b.write('II', 6, 'latin1'); b.writeUInt16LE(42, 8); b.writeUInt32LE(8, 10);
    b.writeUInt16LE(1, 14); b.writeUInt16LE(tag, 16);
    return b;
  };
  assert.equal(exifHasGps(exif(0x8825)), true);
  assert.equal(exifHasGps(exif(0x010f)), false);
  assert.equal(exifHasGps(null), false);
  assert.equal(exifHasGps(Buffer.from('garbage')), false);
});

test('release check: content findings on a fresh data root name what is missing', async () => {
  const f = await contentFindings({
    settings: { siteUrl: 'http://x/', description: '', plateTitle: '' },
    doors: {}, media: {}, wall: {}, cabinet: {}, plates: {}, surround: {},
    items: [
      { id: 'a', exhibit: { slug: 'dscf1', inv: 1, title: 'Dscf1', description: '', gallery: [] } },
      { id: 'b', exhibit: { slug: 'ok', inv: 2, title: 'Fine', medium: 'oil', description: 'Text.', gallery: ['nope'] } },
      { id: 'c', off: true, exhibit: { slug: 'stored', inv: 3, title: '', description: '' } },
    ],
  });
  const errors = f.filter(x => x.level === 'error').map(x => x.msg).join('\n');
  assert.match(errors, /název vypadá jako jméno souboru/);
  assert.match(errors, /chybí popis/);
  assert.match(errors, /galerie odkazuje na fotku, která v knihovně není/);
  assert.match(errors, /https a končit lomítkem/);
  assert.match(errors, /Chybí popis webu/);
  assert.doesNotMatch(errors, /stored/); // exhibits stored off the wall never go public, so they are not checked
});

test('publish: inert without origin, stopped by the release audit, then commit + rebase + push to a fake origin', async () => {
  const sh = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
  const post = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }).then(async r => ({ ...(await r.json()), code: r.status }));
  const get = u => fetch(BASE + u).then(r => r.json());

  // not a repository / no origin: nothing to publish to, and it says why
  assert.equal((await get('/api/git')).repo, false);
  assert.match((await post('/api/publish')).error, /není git repozitář|origin/);

  // a repository whose index carries an original photo (as Kabinet's Inport_foto did) …
  sh(tmp, 'init', '-q', '-b', 'main');
  sh(tmp, 'config', 'user.name', 'Test'); sh(tmp, 'config', 'user.email', '1+t@users.noreply.github.com');
  await fs.writeFile(path.join(tmp, '.gitignore'), 'assets-inbox/\n.media-tmp/\n');
  await fs.mkdir(path.join(tmp, 'Inport_foto'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'Inport_foto', 'IMG_1.jpg'), 'original');
  sh(tmp, 'add', '.gitignore'); sh(tmp, 'add', '-f', 'Inport_foto'); sh(tmp, 'commit', '-qm', 'first');
  const origin = await fs.mkdtemp(path.join(os.tmpdir(), 'kabinet-origin-'));
  sh(origin, 'init', '-q', '--bare', '-b', 'main');
  sh(tmp, 'remote', 'add', 'origin', origin);

  // … is refused before any commit is made, and nothing reaches the origin
  const refused = await post('/api/publish', { acknowledge: true });
  assert.equal(refused.code, 400);
  assert.match(refused.error, /originálních fotek/);
  assert.equal(sh(tmp, 'rev-list', '--count', 'HEAD'), '1');
  assert.equal(execFileSync('git', ['--git-dir', origin, 'branch', '--list'], { encoding: 'utf8' }).trim(), '');

  // untracked, the audit is clean; content errors need the owner's OK
  sh(tmp, 'rm', '-rq', '--cached', 'Inport_foto'); await fs.writeFile(path.join(tmp, '.gitignore'), 'assets-inbox/\n.media-tmp/\nInport_foto/\n');
  await fs.rm(path.join(tmp, 'Inport_foto'), { recursive: true });
  const pf = await get('/api/preflight');
  assert.deepEqual(pf.audit.filter(f => f.level === 'error'), []);
  const ok = await post('/api/publish', { message: 'First release', acknowledge: true });
  assert.equal(ok.code, 200, ok.error);
  assert.equal(execFileSync('git', ['--git-dir', origin, 'log', '-1', '--format=%s', 'main'], { encoding: 'utf8' }).trim(), 'First release');
  assert.ok(execFileSync('git', ['--git-dir', origin, 'ls-tree', '-r', '--name-only', 'main'], { encoding: 'utf8' }).includes('data/cabinet.json'));
  assert.doesNotMatch(execFileSync('git', ['--git-dir', origin, 'ls-tree', '-r', '--name-only', 'main'], { encoding: 'utf8' }), /Inport_foto|assets-inbox/);

  // the preview compares with what GitHub has
  assert.equal((await get('/api/changes')).count, 0);
  assert.equal((await call('PATCH', '/api/settings', { description: 'A new description of the site.' })).status, 200);
  const ch = await get('/api/changes');
  assert.deepEqual(ch.settings.map(s => s.label), ['Popis webu']);

  // another copy published meanwhile: publishing takes that first (rebase), then pushes
  const other = await fs.mkdtemp(path.join(os.tmpdir(), 'kabinet-other-'));
  sh(other, 'clone', '-q', origin, 'c'); const c = path.join(other, 'c');
  sh(c, 'config', 'user.name', 'Other'); sh(c, 'config', 'user.email', '2+o@users.noreply.github.com');
  await fs.writeFile(path.join(c, 'NOTE.txt'), 'from elsewhere\n'); sh(c, 'add', '.'); sh(c, 'commit', '-qm', 'elsewhere'); sh(c, 'push', '-q');
  const second = await post('/api/publish', { message: 'Second release', acknowledge: true });
  assert.equal(second.code, 200, second.error);
  assert.match(second.log, /spojuji/);
  const tree = execFileSync('git', ['--git-dir', origin, 'ls-tree', '-r', '--name-only', 'main'], { encoding: 'utf8' });
  assert.match(tree, /NOTE\.txt/);
  assert.match(execFileSync('git', ['--git-dir', origin, 'log', '--format=%s', 'main'], { encoding: 'utf8' }), /Second release/);
  assert.equal((await get('/api/git')).ahead, 0);
  await fs.rm(origin, { recursive: true, force: true }); await fs.rm(other, { recursive: true, force: true });
});

test('changes preview: exhibits by field, wall things, media, settings, room parts', () => {
  const ex = (title, extra = {}) => ({ id: 'a', x: 0, y: 0, w: 100, exhibit: { slug: 'a', inv: 1, title, medium: 'oil', description: 'd', gallery: [], tags: [], plaque: true, ...extra } });
  const before = { settings: { description: 'x', fx: {} }, items: [ex('Old'), { id: 'candle', x: 1, y: 1, w: 9 }], media: { m1: { v: 1 } }, doors: { closed: 'm1' } };
  const after = { settings: { description: 'y', fx: {} }, items: [ex('New', { gallery: ['g1'] }), { id: 'candle', x: 5, y: 1, w: 9 }, { id: 'bust', x: 0, y: 0, w: 5, off: true }], media: { m1: { v: 2 }, m2: { v: 1 } }, doors: { closed: 'm2' } };
  const d = diffCabinet(before, after);
  assert.deepEqual(d.exhibits.edited[0].fields.map(f => f.label), ['Název', 'Galerie']);
  assert.equal(d.things.moved, 1); assert.equal(d.things.added, 0, 'stored (off) items never go public');
  assert.deepEqual(d.media, { added: 1, removed: 0, replaced: 1 });
  assert.deepEqual(d.settings.map(s => s.label), ['Popis webu']);
  assert.deepEqual(d.rooms, ['Dveře']);
  assert.equal(diffCabinet(null, after).exhibits.added.length, 1, 'nothing published yet: everything is new');
  assert.equal(diffCabinet(after, after).count, 0);
});

test('noindex (soft launch): robots meta on every page, no sitemap; off again restores both', async () => {
  const wait = () => call('POST', '/api/rebuild'); // builds now (the scheduled one waits 300 ms)
  assert.equal((await call('PATCH', '/api/settings', { noindex: true })).status, 200); await wait();
  for (const u of ['/preview/', '/preview/cabinet/', '/preview/list/']) assert.match(await (await fetch(BASE + u)).text(), /<meta name="robots" content="noindex, nofollow">/, u);
  assert.equal((await fetch(BASE + '/preview/sitemap.xml')).status, 404);
  assert.doesNotMatch(await (await fetch(BASE + '/preview/robots.txt')).text(), /Sitemap/);
  assert.equal((await call('PATCH', '/api/settings', { noindex: false })).status, 200); await wait();
  assert.doesNotMatch(await (await fetch(BASE + '/preview/')).text(), /name="robots"/);
  assert.equal((await fetch(BASE + '/preview/sitemap.xml')).status, 200);
});
