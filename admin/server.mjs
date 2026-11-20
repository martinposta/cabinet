// Local admin server, runs only on this computer (127.0.0.1), never on GitHub.
//   npm run admin  →  http://localhost:4322
//   /           admin UI (admin/public)
//   /preview/   the generated public site (docs/), as it will look online
//   /api/*      JSON API

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { ADMIN, PATHS, KINDS, IMAGE } from '../lib/config.mjs';
import { loadData, reloadData } from '../lib/store.mjs';
import { buildSite, plates, surround } from '../lib/build.mjs';
import { availableLooks } from '../lib/look.mjs';
import { previewLook } from '../lib/images.mjs';
import * as C from '../lib/cabinet.mjs';
import { diffCabinet } from '../lib/changes.mjs';
import { configureGit, gitStatus, gitBusy, fetchRemote, syncPull, startupSync, publish, publishedBaseline, preflight } from './git.mjs';

const MAX_UPLOAD = 200 * 1024 * 1024;
const ORIGINS = new Set([`http://localhost:${ADMIN.port}`, `http://127.0.0.1:${ADMIN.port}`]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8',
};

function send(res, code, body, type = 'application/json; charset=utf-8') {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(data);
}

async function serveStatic(res, baseDir, relPath) {
  let file = path.normalize(path.join(baseDir, decodeURIComponent(relPath)));
  if (file !== baseDir && !file.startsWith(baseDir + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  try {
    const st = await fsp.stat(file);
    if (st.isDirectory()) file = path.join(file, 'index.html');
    await fsp.access(file);
  } catch {
    const nf = path.join(baseDir, '404.html');
    if (fs.existsSync(nf)) { res.writeHead(404, { 'Content-Type': MIME['.html'] }); return fs.createReadStream(nf).pipe(res); }
    return send(res, 404, 'Not found', 'text/plain');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

// ---------- build scheduling ----------

let buildTimer = null;
let buildPromise = Promise.resolve();
function scheduleBuild() {
  clearTimeout(buildTimer);
  buildTimer = setTimeout(() => { buildPromise = buildPromise.then(buildSite).catch(err => console.error('Build failed:', err)); }, 300);
}

function readBody(req, limit = MAX_UPLOAD) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new C.UserError('Soubor je příliš velký')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req, 2 * 1024 * 1024);
  try { return buf.length ? JSON.parse(buf.toString('utf8')) : {}; }
  catch { throw new C.UserError('Neplatný JSON'); }
}

async function api(req, res, url) {
  const m = req.method, p = url.pathname, q = k => url.searchParams.get(k) || '';
  let r;
  if (m === 'GET' && p === '/api/state') {
    await buildPromise;
    const kinds = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, { label: v.label, min: v.min, max: v.max }]));
    const data = await loadData();
    // plates with their defaults filled in, so the admin's wall (the site's own code) and the form agree
    return send(res, 200, { data: { ...data, plates: plates(data), surround: surround(data) }, rev: C.layoutRev(data), kinds, looks: await availableLooks(), accepted: IMAGE.acceptedExt });
  }
  // ---- git: status, preview of changes, release check, sync, publish (phase 5; inert without an origin) ----
  if (m === 'GET' && p === '/api/git') return send(res, 200, await gitStatus());
  if (m === 'GET' && p === '/api/changes') { await buildPromise; return send(res, 200, diffCabinet(await publishedBaseline(), await loadData())); }
  if (m === 'GET' && p === '/api/preflight') return send(res, 200, await preflight());
  if (m === 'POST' && p === '/api/sync/check') { if (!gitBusy()) await fetchRemote(); return send(res, 200, await gitStatus()); }
  if (m === 'POST' && p === '/api/sync') return send(res, 200, await syncPull());
  if (m === 'POST' && p === '/api/publish') { const b = await readJson(req); return send(res, 200, await publish(b.message, { acknowledge: !!b.acknowledge })); }
  // while git rewrites the data files (pull, rebase), an edit would be written into the middle of it
  if (m !== 'GET' && gitBusy()) return send(res, 409, { error: 'Právě probíhá synchronizace s GitHubem, zkus to za chvíli.' });

  if (m === 'POST' && p === '/api/rebuild') { await buildPromise; return send(res, 200, await buildSite()); }
  // before/after preview of a look on a file that is not imported yet; changes nothing
  if (m === 'POST' && p === '/api/look-preview') {
    try { return send(res, 200, await previewLook(await readBody(req), q('look') || null), 'image/jpeg'); }
    catch (err) { throw new C.UserError(`Náhled se nepodařil: ${err.message}`); }
  }

  if (m === 'POST' && p === '/api/media') r = await C.importMedia(await readBody(req), q('name'), q('kind'), q('look') || null);
  else if (m === 'POST' && (r = p.match(/^\/api\/media\/(\w+)\/replace$/))) { const id = r[1]; r = await C.replaceMedia(id, await readBody(req), q('name')); }
  else if (m === 'POST' && (r = p.match(/^\/api\/media\/(\w+)\/look$/))) r = await C.relookMedia(r[1], (await readJson(req)).look || null);
  else if (m === 'PATCH' && (r = p.match(/^\/api\/media\/(\w+)$/))) r = await C.updateMedia(r[1], await readJson(req));
  else if (m === 'DELETE' && (r = p.match(/^\/api\/media\/(\w+)$/))) r = await C.deleteMedia(r[1]);
  else if (m === 'POST' && p === '/api/sound') r = await C.importSound(await readBody(req, 4 * 1024 * 1024), q('name'));
  else if (m === 'PUT' && p === '/api/hand-candle') r = await C.setHandCandle(await readJson(req));
  else if (m === 'PATCH' && p === '/api/settings') r = await C.updateSettings(await readJson(req));
  else if (m === 'PATCH' && p === '/api/plates') r = await C.setPlates(await readJson(req));
  else if (m === 'PATCH' && p === '/api/surround') r = await C.setSurround(await readJson(req));
  else if (m === 'POST' && p === '/api/roles') { const b = await readJson(req); r = await C.setRole(b.role, b.media || null); }
  else if (m === 'PATCH' && p === '/api/wall') r = await C.updateWall(await readJson(req));
  else if (m === 'PATCH' && p === '/api/cabinet') r = await C.updateCabinet(await readJson(req));
  else if (m === 'PATCH' && p === '/api/doors') r = await C.setDoorsOpening(await readJson(req));
  else if (m === 'PATCH' && p === '/api/notices-board') r = await C.setNoticesBoard(await readJson(req));
  else if (m === 'POST' && p === '/api/notices') r = await C.addNotice(await readJson(req));
  else if (m === 'PATCH' && (r = p.match(/^\/api\/notices\/(\w+)$/))) r = await C.updateNotice(r[1], await readJson(req));
  else if (m === 'DELETE' && (r = p.match(/^\/api\/notices\/(\w+)$/))) r = await C.deleteNotice(r[1]);
  else if (m === 'POST' && p === '/api/items') r = await C.addItem(await readJson(req));
  else if (m === 'PUT' && p === '/api/layout') r = await C.replaceLayout(await readJson(req));
  else if (m === 'PATCH' && (r = p.match(/^\/api\/items\/([\w-]+)$/))) r = await C.updateItem(r[1], await readJson(req));
  else if (m === 'DELETE' && (r = p.match(/^\/api\/items\/([\w-]+)$/))) r = await C.deleteItem(r[1]);
  else return send(res, 404, { error: 'Neznámý požadavek' });

  scheduleBuild();
  return send(res, 200, r);
}

const server = http.createServer(async (req, res) => {
  try {
    // Only requests addressed to this local server (blocks DNS rebinding and cross-site posts).
    const host = req.headers.host || '';
    if (!ORIGINS.has(`http://${host}`)) return send(res, 403, 'Forbidden host', 'text/plain');
    if (req.method !== 'GET' && req.headers.origin && !ORIGINS.has(req.headers.origin)) return send(res, 403, { error: 'Forbidden origin' });

    const url = new URL(req.url, `http://${host}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    // the old wall editor lives in the admin's section Stěna since phase 3b
    if (url.pathname === '/editor') { res.writeHead(302, { Location: '/#stena' }); return res.end(); }
    // the site's modules build relative media/… URLs; the admin page sits at /, so it serves them here too
    if (url.pathname.startsWith('/media/')) return await serveStatic(res, PATHS.media, url.pathname.slice('/media/'.length));
    if (url.pathname === '/preview') { res.writeHead(302, { Location: '/preview/' }); return res.end(); }
    if (url.pathname.startsWith('/preview/')) return await serveStatic(res, PATHS.docs, url.pathname.slice('/preview/'.length));
    return await serveStatic(res, PATHS.adminPublic, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  } catch (err) {
    const user = err instanceof C.UserError;
    if (!user) console.error(err);
    send(res, user ? err.status : 500, { error: user ? err.message : `Chyba serveru: ${err.message}` });
  }
});

configureGit({ buildNow: async () => { await buildPromise; await buildSite(); }, reload: reloadData });
// Catch up with GitHub before anything is loaded: another instance may have published (no origin = nothing to do).
const started = await startupSync();
if (started.pulled) console.log(`\n  Staženo z GitHubu: ${started.pulled} ${started.pulled === 1 ? 'změna' : 'změn'}.`);
await loadData();
await buildSite();

server.listen(ADMIN.port, ADMIN.host, () => {
  const link = `http://localhost:${ADMIN.port}`;
  console.log(`\n  Kabinet admin běží na ${link}`);
  console.log(`  Náhled webu:         ${link}/preview/`);
  console.log(`  Ukončení:            Ctrl+C\n`);
  // `npm run admin` runs under node --watch, which restarts this process after every code change; the
  // browser is opened only on the first start of that watch session (the watcher is our parent process)
  const opened = path.join(os.tmpdir(), `kabinet-admin-opened-${process.ppid}`);
  if (!process.env.NO_OPEN && !fs.existsSync(opened)) {
    try { fs.writeFileSync(opened, ''); } catch {}
    const cmd = process.platform === 'darwin' ? ['open', [link]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', link]] : ['xdg-open', [link]];
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  }
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') console.error(`\n  Port ${ADMIN.port} je obsazený, admin už možná běží. Otevři http://localhost:${ADMIN.port}\n`);
  else console.error(err);
  process.exit(1);
});
