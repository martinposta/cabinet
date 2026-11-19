// Shared core of the admin (phase 3b): the working copy of the data, the API, saving with the layout
// revision check, undo/redo, and a tiny event bus the sections listen on. No framework (D9).

import { mediaUrl } from '/preview/js/media.js';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const r2 = v => Math.round(v * 100) / 100;
export const NAMEPLATE = '__nameplate';

/** S = last /api/state answer (kinds, looks…), D = the working copy of the data, rev = layout revision. */
export const store = { S: null, D: null, rev: null };

// ---------- events ----------
const bus = new EventTarget();
export const on = (name, fn) => bus.addEventListener(name, e => fn(e.detail));
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));

// ---------- api ----------
export async function api(method, url, body, raw) {
  const opts = { method, headers: {} };
  if (raw) opts.body = raw;
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Chyba ${res.status}`);
  return json;
}

// ---------- save status (top bar) ----------
let statusEl = null;
export function bindStatus(el) { statusEl = el; }
/** kind: ok | saving | dirty | err | info */
export function status(kind, text) {
  if (!statusEl) return;
  const label = text || { ok: 'Uloženo', saving: 'Ukládám…', dirty: 'Neuloženo…', err: 'Chyba' }[kind] || '';
  statusEl.className = 'save ' + kind;
  statusEl.innerHTML = `<span class="dot"></span><span class="txt"></span>`;
  statusEl.querySelector('.txt').textContent = label;
  statusEl.title = label;
}

// ---------- loading ----------
export async function load() {
  const S = await api('GET', '/api/state');
  store.S = S; store.D = structuredClone(S.data); store.rev = S.rev;
  emit('data');
  return S;
}

/**
 * After a change that is not the layout (settings, media, cabinet…): wait for pending layout saves,
 * then take the server's data. The layout itself is still ours – it was just saved.
 */
export async function refresh() {
  await flush();
  const S = await api('GET', '/api/state');
  store.S = S; store.D = structuredClone(S.data); store.rev = S.rev;
  emit('data');
}

// ---------- layout: commit, save, undo ----------
// The layout (items + nameplate) is saved whole with PUT /api/layout and the revision it started from;
// a save based on an outdated layout is refused by the server (409), never silently written over.
let saveTimer = null, saving = Promise.resolve(), stale = false;
export function scheduleSave() {
  clearTimeout(saveTimer);
  status('dirty');
  saveTimer = setTimeout(saveNow, 350);
}
function saveNow() {
  saveTimer = null;
  if (stale) return saving;
  const { D } = store;
  status('saving');
  saving = saving.then(() => api('PUT', '/api/layout', { items: D.items, nameplate: D.nameplate, view: D.view ?? null, room: D.room ?? null, rev: store.rev }))
    .then(r => { store.rev = r.rev; status('ok'); })
    .catch(err => { if (/změnilo jinde/.test(err.message)) stale = true; status('err', 'Neuloženo: ' + err.message); });
  return saving;
}
/** Waits until every pending layout save has gone out. */
export async function flush() { if (saveTimer) { clearTimeout(saveTimer); saveNow(); } await saving; }
export const unsaved = () => !!saveTimer || stale;

const undo = [], redo = [];
let lastCommit = { label: '', t: 0 };
const snapshot = () => JSON.stringify({ items: store.D.items, nameplate: store.D.nameplate, view: store.D.view ?? null, room: store.D.room ?? null });
// Undo on the wall restores places, sizes and what is an exhibit – never the texts: an exhibit's
// content written in Exponáty keeps its current version (otherwise ⌘Z on the wall would undo a description).
function restore(json) {
  const s = JSON.parse(json), D = store.D;
  const now = new Map(D.items.map(i => [i.id, i]));
  for (const it of s.items) {
    const cur = now.get(it.id)?.exhibit;
    if (it.exhibit && cur) it.exhibit = { ...cur, inv: it.exhibit.inv, slug: it.exhibit.slug };
  }
  D.items = s.items; D.nameplate = s.nameplate; D.view = s.view; D.room = s.room;
}
export const canUndo = () => undo.length > 0;
export const canRedo = () => redo.length > 0;

/**
 * Applies `mutate` to the working layout, records the state before it for undo (the same label within
 * 700 ms is one step – nudges, typing), and saves. `undoable:false` for texts edited in Exponáty.
 */
export function commit(label, mutate, { undoable = true } = {}) {
  const before = snapshot();
  mutate(store.D);
  if (snapshot() === before) return false;
  const t = Date.now();
  if (undoable) {
    if (!(label && lastCommit.label === label && t - lastCommit.t < 700)) { undo.push(before); if (undo.length > 200) undo.shift(); }
    lastCommit = { label, t };
    redo.length = 0;
  }
  emit('layout', { label });
  scheduleSave();
  return true;
}
export function doUndo() { if (!undo.length) return; redo.push(snapshot()); restore(undo.pop()); lastCommit = { label: '', t: 0 }; emit('layout', { label: 'undo' }); scheduleSave(); }
export function doRedo() { if (!redo.length) return; undo.push(snapshot()); restore(redo.pop()); lastCommit = { label: '', t: 0 }; emit('layout', { label: 'redo' }); scheduleSave(); }

// ---------- helpers shared by sections ----------
export const item = id => store.D.items.find(i => i.id === id);
export const where = d => d.drawer != null ? 'drawer' : d.on === 'cabinet' ? 'cabinet' : 'wall';
/** Admin-side URL of a media file (the site builds relative ones). */
export const mediaSrc = (id, w) => { const m = store.D.media[id]; if (!m?.widths) return ''; return '/preview/' + mediaUrl(id, m, w ?? m.widths[0]); };
export const humanize = id => String(id).replace(/-\d+$/, m => ' ' + m.slice(1)).replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
export const itemName = d => d.exhibit?.title || humanize(d.id);
export const inv = n => String(n).padStart(3, '0');
export function uniqueId(base) {
  const root = String(base || 'item').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
  let id = root, n = 2;
  while (store.D.items.some(i => i.id === id)) id = `${root}-${n++}`;
  return id;
}
export function uniqueSlug(base) {
  let s = base, n = 2;
  while (store.D.items.some(i => i.exhibit?.slug === s)) s = `${base}-${n++}`;
  return s;
}
export const nextInv = () => Math.max(0, ...store.D.items.map(i => i.exhibit?.inv || 0)) + 1;
/** What an exhibit still lacks (Czech), for the summary card and the list. */
export function missing(ex) {
  const out = [];
  if (!ex.title || !ex.medium || !ex.description) out.push(!ex.description ? 'Chybí popis' : 'Chybí název nebo technika');
  if (!(ex.gallery || []).some(g => store.D.media[g])) out.push('Chybí fotky do galerie');
  return out;
}
/** Where a media item is used, as [label, hash] pairs. */
export function usage(id) {
  const D = store.D, out = [];
  for (const it of D.items) {
    if (it.media === id) out.push(it.off ? [itemName(it) + ' (mimo stěnu)', `#exponaty/${it.exhibit.slug}`] : [itemName(it) + ' (stěna)', `#stena/${it.id}`]);
    if (it.exhibit?.gallery?.includes(id)) out.push([`galerie ${it.exhibit.title || it.id}`, `#exponaty/${it.exhibit.slug}`]);
  }
  if (D.wall.wallpaper === id) out.push(['tapeta', '#mistnost/tapeta']);
  if (D.wall.grime === id) out.push(['špína', '#mistnost/tapeta']);
  if (D.cabinet.body === id) out.push(['korpus skříně', '#mistnost/skrin']);
  if (D.cabinet.tray === id) out.push(['samet', '#mistnost/skrin']);
  (D.cabinet.drawers || []).forEach((x, i) => { if (x.front === id) out.push([`čelo šuplíku ${i + 1}`, '#mistnost/skrin']); });
  if (D.doors?.closed === id) out.push(['zavřené dveře', '#mistnost/dvere']);
  if (D.doors?.ajar === id) out.push(['pootevřené dveře', '#mistnost/dvere']);
  if (D.doors?.sound === id) out.push(['vrznutí', '#mistnost/dvere']);
  if (D.doors?.frame === id) out.push(['futra', '#mistnost/dvere']);
  if (D.handCandle?.media === id) out.push(['svíčka místo kurzoru', '#mistnost/efekty']);
  if (D.plates?.nameplate?.media === id) out.push(['jmenovka', '#mistnost/jmenovka']);
  if (D.plates?.plaque?.media === id) out.push(['štítky pod exponáty', '#mistnost/jmenovka']);
  for (const [k, l] of [['sideTop', 'hlavice boku'], ['sideMid', 'výplň boku'], ['cornice', 'římsa'], ['wainscot', 'lambrie']]) if (D.surround?.[k] === id) out.push([l, '#mistnost/oblozeni']);
  return out;
}

// ---------- a small modal: pick a media item ----------
/** Resolves with a media id, or null when cancelled. `kinds`: which kinds to offer. */
export function pickMedia({ title, kinds, current }) {
  return new Promise(resolve => {
    const D = store.D;
    const list = Object.entries(D.media).filter(([, m]) => kinds.includes(m.kind)).sort((a, b) => (b[1].addedAt || '').localeCompare(a[1].addedAt || ''));
    const dlg = document.createElement('div');
    dlg.className = 'modal';
    dlg.innerHTML = `<div class="modal-box wide" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-x aria-label="Zavřít">×</button></div>
      <div class="pick-grid">${list.map(([id, m]) => `<button class="pick${id === current ? ' on' : ''}" data-id="${id}" title="${esc(m.name)}">
        <span class="checker thumb ck"><img src="${mediaSrc(id)}" alt=""></span><span class="nm">${esc(m.name)}</span></button>`).join('')
        || '<p class="hint">V knihovně zatím nic takového není. Nahraj to v Knihovně.</p>'}</div>
    </div>`;
    const done = v => { dlg.remove(); removeEventListener('keydown', key, true); resolve(v); };
    const key = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); done(null); } };
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-x]')) done(null); const b = e.target.closest('.pick'); if (b) done(b.dataset.id); });
    stopPointer(dlg);
    document.body.appendChild(dlg);
    addEventListener('keydown', key, true);
  });
}

/** Overlays and panels keep pointer and wheel to themselves (the wall's camera listens on body/window). */
export function stopPointer(el) { ['wheel', 'pointerdown'].forEach(t => el.addEventListener(t, e => e.stopPropagation(), { passive: true })); }
