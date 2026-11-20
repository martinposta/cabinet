// Section 1 · Stěna (phase 3b; was /editor). The real wall, rendered by the public site's own modules
// from the working copy of the data. Every change goes through core.commit (undo, save with revision).
// Gestures and shortcuts are the phase 3 editor's, unchanged.

import { buildWall } from '/preview/js/wall.js';
import { startCamera, openingView } from '/preview/js/camera.js';
import { openShelves } from './shelves.js';
import { decorSvgs } from '/preview/js/placeholders.js';
import { mediaUrl } from '/preview/js/media.js';
import { $, $$, esc, r2, NAMEPLATE, store, on, emit, commit, doUndo, doRedo, status, item, where, mediaSrc, itemName,
  inv, uniqueId, uniqueSlug, nextInv, missing, pickMedia, stopPointer } from './core.js';
import { openImport } from './knihovna.js';

const SNAP_PX = 12;      // snapping distance in screen px
const SLACK = 700;       // world px the editor may look past the public site's bounds
const ui = { viewerOpen: true };   // the camera ignores input while true: the section is hidden
let W, camera, active = false;
let sel = new Set(), primary = null;
let panMode = false, snapOn = true;
let tab = 'umisteni';
const world = () => $('#world');
const D = () => store.D;
const elOf = id => world().querySelector(`[data-id="${CSS.escape(id)}"]`);
const expanded = w => ({ x0: w.x0 - SLACK, x1: w.x1 + SLACK, y0: w.y0 - SLACK, y1: w.y1 + SLACK });

// ---------- building the wall ----------
let tileFor = null;
function wallpaper() {
  const id = D().wall?.wallpaper, tile = id && D().media[id];
  const key = tile ? `${id}|${tile.v}|${D().wall.tileWorld}` : 'painted';
  if (key === tileFor) return; tileFor = key;
  if (!tile) return;
  const im = new Image();
  im.onload = () => { window.__wallTile = im; window.__wallTileScale = (D().wall.tileWorld || 280) / im.naturalWidth; window.__wallDirty = true; };
  im.src = '/' + mediaUrl(id, tile, tile.widths[tile.widths.length - 1]);
}
// what hangs: exhibits taken off the wall stay in the data (off) and live on only in Exponáty
const hung = () => D().items.filter(i => !i.off);
let layoutVer = 0;
function rebuild() {
  layoutVer++; ovDirty = true;
  const open = $$('#world .drawer').map(d => d.classList.contains('open'));
  world().innerHTML = '';
  W = buildWall(world(), { ...D(), items: hung() });
  W.paintAll();
  W.DRAWERS.forEach((d, i) => { if (open[i]) openDrawer(i); });
  if (camera) { camera.setWall(expanded(W.WALL)); camera.invalidate(); }
  wallpaper();
  pruneSel();
  renderLayers(); renderInspector(); renderFoot();
}
function openDrawer(i) { const dr = W.DRAWERS[i]; if (!dr) return; dr.el.classList.add('open'); dr.el.querySelector('.front').setAttribute('aria-expanded', 'true'); }

// ---------- selection ----------
function pruneSel() { for (const id of [...sel]) if (id !== NAMEPLATE && (!item(id) || item(id).off)) sel.delete(id); if (primary && !sel.has(primary)) primary = [...sel][0] || null; }
function select(id, add) {
  ovDirty = true;
  if (add) { if (sel.has(id)) { sel.delete(id); if (primary === id) primary = [...sel][0] || null; } else { sel.add(id); primary = id; } }
  else { sel = new Set(id ? [id] : []); primary = id; }
  renderInspector(); markLayers(); renderFoot();
  const h = primary && primary !== NAMEPLATE ? `#stena/${primary}` : '#stena';
  if (location.hash !== h) history.replaceState(null, '', h);
}
/** Selects an item and brings it into view (drawer items: their drawer opens). */
export function reveal(id) {
  const d = id === NAMEPLATE ? null : item(id);
  if (id !== NAMEPLATE && !d) return;
  select(id, false);
  const p = worldPos(id);
  if (p) camera.focusOn(p.x, p.y);
}
function worldPos(id) {
  if (id === NAMEPLATE) return { x: D().nameplate.x, y: D().nameplate.y };
  const d = item(id); if (!d || !W) return null;
  if (d.drawer != null) {
    const dr = W.DRAWERS[d.drawer]; if (!dr) return null;
    openDrawer(d.drawer);
    return { x: W.CAB.x0 + dr.x + dr.w / 2, y: W.CAB.top + dr.y + dr.h / 2 };
  }
  if (d.on === 'cabinet') return { x: d.x, y: W.CAB.top - sizeOf(d).h / 2 };
  return { x: d.x, y: d.y };
}

// ---------- geometry ----------
function worldBox(el) {
  const r = el.getBoundingClientRect(), a = camera.toWorld(r.left, r.top), b = camera.toWorld(r.right, r.bottom);
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
}
// outer world size of an item (what the box on screen shows), used to keep corners in place on resize
function sizeOf(d) {
  const ph = d.placeholder;
  if (d.media) { const m = D().media[d.media]; return { w: d.w, h: d.w * m.h / m.w }; }
  if (ph.paint === 'object') return { w: ph.w + 56, h: ph.h + 62 };
  const f = (ph.frame?.fw ?? 20) + 6;
  return { w: ph.w + 2 * f, h: ph.h + 2 * f };
}
const screenY = wy => (wy - camera.toWorld(0, 0).y) * camera.zoom();
const screenX = wx => (wx - camera.toWorld(0, 0).x) * camera.zoom();

// ---------- overlay: selection, handles, page end (screen space, every frame) ----------
const boxes = new Map();
let handles = null;
// Every overlay element is moved by transform (will-change in admin.css): moving it then only recomposites
// a small layer. It used to set left/top, and the start view's frame dimmed the screen with a 9999 px
// box-shadow – so every frame of a pan or zoom repainted the whole screen (the editor's lag, 2026-10-25).
const place = (el, x, y, w, h) => {
  el.style.transform = `translate3d(${x}px,${y}px,0)`;
  if (w != null && el._w !== w) { el._w = w; el.style.width = w + 'px'; }
  if (h != null && el._h !== h) { el._h = h; el.style.height = h + 'px'; }
};
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
let ovKey = '', ovDirty = true;
const markOverlay = () => { ovDirty = true; };
function drawOverlay() {
  requestAnimationFrame(drawOverlay);
  if (!active || !camera) return;
  // nothing moved and nobody touched anything: the overlay is as it was
  const key = world().style.transform + '|' + innerWidth + '|' + innerHeight;
  if (key === ovKey && !ovDirty && !drag && !roomDrag && !startDrag) return;
  ovKey = key; ovDirty = false;
  const ov = $('#overlay'), z = camera.zoom();
  for (const [id, b] of boxes) if (!sel.has(id)) { b.remove(); boxes.delete(id); }
  for (const id of sel) {
    const el = elOf(id); if (!el) continue;
    let b = boxes.get(id);
    if (!b) { b = document.createElement('div'); b.className = 'selbox'; b.innerHTML = '<span class="lbl"></span>'; ov.appendChild(b); boxes.set(id, b); }
    const r = el.getBoundingClientRect();
    place(b, r.left, r.top, r.width, r.height);
    b.classList.toggle('primary', id === primary);
    const name = id === NAMEPLATE ? 'Jmenovka' : itemName(item(id) || {});
    setText(b.firstChild, id === primary ? `${name} · ${Math.round(r.width / z)} × ${Math.round(r.height / z)}` : '');
    b.firstChild.hidden = id !== primary;
  }
  // handles: four corners (size, aspect kept) and a rotation knob, for one item on the wall or cabinet
  const one = sel.size === 1 && primary && primary !== NAMEPLATE ? item(primary) : null;
  // in a drawer only the knob: its size is fitted to the drawer, so corners would not mean anything
  const mode = !one || one.locked ? null : one.drawer == null ? 'all' : 'rot';
  if (handles && handles.mode !== mode) { handles.forEach(h => h.remove()); handles = null; }
  const can = !!mode;
  if (can && !handles) {
    handles = (mode === 'all' ? ['nw', 'ne', 'sw', 'se', 'rot'] : ['rot']).map(k => { const h = document.createElement('div'); h.className = 'hd ' + k; h.dataset.h = k; h.title = k === 'rot' ? 'Natočení' : 'Velikost (drží poměr stran)'; ov.appendChild(h); h.addEventListener('pointerdown', k === 'rot' ? startRotate : startResize); return h; });
    handles.mode = mode;
  }
  if (!can && handles) { handles.forEach(h => h.remove()); handles = null; }
  if (handles) {
    const r = elOf(primary)?.getBoundingClientRect();
    if (r) {
      const pos = { nw: [r.left, r.top], ne: [r.right, r.top], sw: [r.left, r.bottom], se: [r.right, r.bottom], rot: [(r.left + r.right) / 2, r.top - 26] };
      handles.forEach(h => { const [x, y] = pos[h.dataset.h]; place(h, x, y); });
    }
  }
  // shelves: of the selected bookcase, and of every bookcase while something is being dragged
  const marks = drag?.moved ? drag.targets.filter(t => t.shelf) : primary && primary !== NAMEPLATE ? shelvesOf(primary) : [];
  const pool = $$('.shelfmark', ov);
  marks.forEach((t, i) => {
    const b = pool[i] || ov.appendChild(Object.assign(document.createElement('div'), { className: 'shelfmark' }));
    place(b, screenX(t.x0), screenY(t.top), (t.x1 - t.x0) * z, (t.y0 - t.top) * z);
  });
  pool.slice(marks.length).forEach(b => b.remove());
  // the public page ends here (CUT_Y): nothing below it is ever seen
  if (W) place($('.cut-line', ov), 0, screenY(W.CUT_Y));
  // the page start: the frame a 1440×900 visitor sees on load, the point it is centred on, the cabinet's axis
  if (W) {
    const S = startDrag || W.START, o = openingView({ ...W, START: S }, 1440, 900);
    const fw = 1440 / o.z * z, fh = 900 / o.z * z;
    place($('.startv', ov), screenX(o.x) - fw / 2, screenY(o.y) - fh / 2, fw, fh);
    place($('.cross', ov), screenX(S.x), screenY(S.y));
    place($('.cab-axis', ov), screenX(W.CAB.cx), 0);
  }
  // the room's size (only while „Velikost místnosti“ is on); outside it is dimmed by four bands that are
  // moved by transform, not by a box-shadow as wide as the screen
  if (W && document.body.classList.contains('show-room')) {
    const r = roomNow(), el = $('.roomv', ov), x0 = screenX(r.x0), x1 = screenX(r.x1), y0 = screenY(r.y0), y1 = screenY(W.CUT_Y);
    place(el, x0, y0, x1 - x0, y1 - y0);
    el.classList.toggle('auto-size', !D().room && !roomDrag);
    const vw = innerWidth, vh = innerHeight, cx = v => Math.max(0, Math.min(vw, v)), cy = v => Math.max(0, Math.min(vh, v));
    const [bt, bb, bl, br] = $$('.roomdim', ov);
    place(bt, 0, cy(y0) - vh, vw, vh); place(bb, 0, cy(y1), vw, vh);
    place(bl, cx(x0) - vw, cy(y0), vw, cy(y1) - cy(y0)); place(br, cx(x1), cy(y0), vw, cy(y1) - cy(y0));
    const fixed = D().room || roomDrag, out = fixed ? outsideRoom(r) : 0;
    setText($('.roomv .tx', ov), `Místnost ${Math.round(r.x1 - r.x0)} × ${Math.round(W.CUT_Y - r.y0)} px` + (fixed ? '' : ' · podle obsahu, táhni okraje') + (out ? ` · ${out} ${out === 1 ? 'věc je' : out < 5 ? 'věci jsou' : 'věcí je'} mimo` : ''));
    $('.roomv .auto', ov).hidden = !D().room;
  }
  setText($('#t-zv'), Math.round(z * 100) + ' %');
}

// ---------- dragging the page start ----------
let startDrag = null;

// ---------- the room's size: left, right and top edge dragged on the wall (bottom = the page end) ----------
// Without data.room the room grows with its content; the first drag fixes it, starting from that size.
let roomDrag = null;
const roomNow = () => roomDrag || D().room || { x0: W.WALL.x0, x1: W.WALL.x1, y0: W.WALL.y0 };
function onRoomDown(e) {
  const edge = e.target.closest('[data-re]')?.dataset.re; if (!edge) return;
  e.stopPropagation(); e.preventDefault();
  const z = camera.zoom(), r0 = { ...roomNow() }, sx = e.clientX, sy = e.clientY;
  roomDrag = { ...r0 };
  const move = ev => {
    const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
    if (edge === 'x0') roomDrag.x0 = Math.min(r0.x0 + dx, r0.x1 - 600);
    if (edge === 'x1') roomDrag.x1 = Math.max(r0.x1 + dx, r0.x0 + 600);
    if (edge === 'y0') roomDrag.y0 = Math.min(r0.y0 + dy, W.CUT_Y - 400);
    // Shift: both side edges move together, the room stays centred on the cabinet
    if (ev.shiftKey && edge !== 'y0') { const c = W.CAB.cx, half = edge === 'x0' ? c - roomDrag.x0 : roomDrag.x1 - c; roomDrag.x0 = c - half; roomDrag.x1 = c + half; }
  };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    const r = roomDrag; roomDrag = null;
    if (Math.abs(r.x0 - r0.x0) + Math.abs(r.x1 - r0.x1) + Math.abs(r.y0 - r0.y0) > 0.5)
      commit('room', D => { D.room = { x0: r2(r.x0), x1: r2(r.x1), y0: r2(r.y0) }; });
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
}
/** Hung things that reach outside the fixed room – a visitor would never see them. */
let outsideCache = { key: '', n: 0 };
function outsideRoom(r) {
  // measured once per room and layout, not every frame (it reads every hung thing's box)
  const key = `${r.x0}|${r.x1}|${r.y0}|${layoutVer}`;
  if (outsideCache.key !== key) outsideCache = { key, n: $$('#world .hang[data-id]').map(worldBox).filter(b => b.x0 < r.x0 - 1 || b.x1 > r.x1 + 1 || b.y0 < r.y0 - 1).length };
  return outsideCache.n;
}
function onCrossDown(e) {
  e.stopPropagation(); e.preventDefault();
  const z = camera.zoom(), sx = e.clientX, sy = e.clientY, s0 = { ...W.START };
  startDrag = { ...s0 };
  const move = ev => {
    startDrag = { x: s0.x + (ev.clientX - sx) / z, y: s0.y + (ev.clientY - sy) / z };
    // close to the cabinet's axis it snaps onto it
    if (snapOn && !ev.altKey && Math.abs(startDrag.x - W.CAB.cx) * z < SNAP_PX) startDrag.x = W.CAB.cx;
  };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    const s = startDrag; startDrag = null;
    if (Math.hypot(s.x - s0.x, s.y - s0.y) > 0.5) commit('view', D => { D.view = { x: r2(s.x), y: r2(s.y) }; });
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
}

// ---------- bookcase shelves: things stand on them (d.sits) and move along with the bookcase ----------
/** Everything standing (directly or on something standing) on any of `ids`, not counting `ids` itself. */
function ridersOf(ids) {
  const set = new Set(ids), out = [];
  for (let grew = true; grew;) {
    grew = false;
    for (const d of D().items) if (d.sits && set.has(d.sits) && !set.has(d.id) && !d.off) { set.add(d.id); out.push(d.id); grew = true; }
  }
  return out;
}
/** The shelves of hung thing `id` as world boxes (x0, x1, y0 = the shelf's bottom edge, the place to stand). */
function shelvesOf(id) {
  const d = item(id), m = d?.media && D().media[d.media];
  if (!m?.shelves || d.off || d.drawer != null || d.on) return [];
  const img = $(`#world .hang[data-id="${CSS.escape(id)}"] img`); if (!img) return [];
  const b = worldBox(img), w = b.x1 - b.x0, h = b.y1 - b.y0;
  return m.shelves.map((s, i) => ({ x0: b.x0 + s.x * w, x1: b.x0 + (s.x + s.w) * w, y0: b.y0 + (s.y + s.h) * h, top: b.y0 + s.y * h, shelf: { host: id, i } }));
}

// ---------- dragging items ----------
let drag = null;
function onWorldDown(e) {
  if (e.button !== 0 || panMode) return;
  // a plaque is dragged on its own: it stays tied to its exhibit, but its place is Martin's to choose
  const pq = e.target.closest('.plaque[data-pq]');
  if (pq && !e.shiftKey) return startPlaqueDrag(e, pq);
  const el = e.target.closest('[data-id]');
  if (!el || e.target.closest('.front')) return;       // drawer fronts keep opening/closing
  e.stopPropagation();                                   // the camera must not pan
  const id = el.dataset.id;
  if (e.shiftKey) { select(id, true); return; }
  if (!sel.has(id)) select(id, false); else { primary = id; renderInspector(); markLayers(); }
  // locked (Inspektor → Zamknout, key L): selected, but it does not move – nor do other locked ones selected with it
  if (isLocked(id)) { status('ok', 'Zamčené – nepohne se. Odemkneš v Inspektoru (L).'); return; }
  const free = [...sel].filter(i => !isLocked(i));
  const z = camera.zoom();
  // what stands on a dragged bookcase goes along with it
  const riders = ridersOf(free.filter(i => i !== NAMEPLATE)).filter(i => !isLocked(i));
  const els = [...free, ...riders].map(i => ({ id: i, el: elOf(i) })).filter(x => x.el)
    .map(x => ({ ...x, ol: parseFloat(x.el.style.left) || 0, ot: parseFloat(x.el.style.top) || 0 }));
  const moving = new Set([...free, ...riders]);
  // snap targets: the tops of other things on the wall, the cabinet board, and the shelves of bookcases
  const targets = $$('#world .hang[data-id], #world .cab-obj[data-id]').filter(t => !moving.has(t.dataset.id)).map(worldBox);
  targets.push({ x0: W.CAB.x0, x1: W.CAB.x0 + W.CAB.w, y0: W.CAB.top, cabinet: true });
  for (const d of D().items) if (!moving.has(d.id)) targets.push(...shelvesOf(d.id));
  drag = { id, sx: e.clientX, sy: e.clientY, z, els, box: worldBox(el), targets, moved: false, snap: null, moving };
}
function onMove(e) {
  if (active && camera) { const p = camera.toWorld(e.clientX, e.clientY); $('#coords').textContent = `X ${Math.round(p.x)} · Y ${Math.round(p.y)}`; }
  if (!drag) return;
  let dx = (e.clientX - drag.sx) / drag.z, dy = (e.clientY - drag.sy) / drag.z;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
  drag.moved = true;
  drag.snap = null;
  const line = $('#overlay .snap-line'); line.hidden = true;
  const d = drag.id !== NAMEPLATE && item(drag.id);
  if (d && d.drawer == null && snapOn && !e.altKey) {
    const b = drag.box, cx = (b.x0 + b.x1) / 2 + dx, bottom = b.y1 + dy;
    let best = null;
    for (const t of drag.targets) {
      if (cx < t.x0 || cx > t.x1) continue;
      const dist = Math.abs(bottom - t.y0);
      if (dist * drag.z < SNAP_PX && (!best || dist < best.dist)) best = { ...t, dist };
    }
    if (best) {
      dy += best.y0 - bottom; drag.snap = best;
      line.hidden = false;
      line.style.cssText = `left:${screenX(best.x0)}px;top:${screenY(best.y0)}px;width:${(best.x1 - best.x0) * camera.zoom()}px`;
    }
  }
  drag.dx = dx; drag.dy = dy;
  for (const x of drag.els) { x.el.style.left = `${x.ol + dx}px`; x.el.style.top = `${x.ot + dy}px`; }
}
function onUp() {
  if (!drag) return;
  const g = drag; drag = null; $('#overlay .snap-line').hidden = true;
  if (!g.moved) return;
  commit('move', D => {
    for (const { id, el, ol } of g.els) {
      if (id === NAMEPLATE) { D.nameplate.x = r2(D.nameplate.x + g.dx); D.nameplate.y = r2(D.nameplate.y + g.dy); continue; }
      const d = item(id);
      if (d.drawer != null) {
        // inside a tray: the new centre as a fraction of the drawer
        const dr = W.DRAWERS[d.drawer], w = el.offsetWidth, h = el.offsetHeight;
        d.dx = r2(Math.min(1, Math.max(0, (ol + g.dx + w / 2) / dr.w)));
        d.dy = r2(Math.min(1, Math.max(0, (parseFloat(el.style.top) + h / 2) / dr.h)));
        continue;
      }
      const onCabinet = id === g.id ? g.snap?.cabinet : null;
      // put on a shelf: it stands there now; moved anywhere else on its own: it no longer does
      if (id === g.id && g.snap?.shelf) d.sits = g.snap.shelf.host;
      else if (d.sits && !g.moving.has(d.sits)) delete d.sits;
      if (where(d) === 'cabinet') {
        d.x = r2(d.x + g.dx);
        // lifted off the board (and not snapped back onto it): it hangs on the wall from now on
        if (!onCabinet && Math.abs(g.dy) > 8) { delete d.on; d.y = r2(W.CAB.top - sizeOf(d).h / 2 + g.dy); }
      } else {
        d.x = r2(d.x + g.dx); d.y = r2(d.y + g.dy);
        if (onCabinet) { d.on = 'cabinet'; d.y = r2(W.CAB.top - sizeOf(d).h / 2); }
      }
    }
  });
}
// ---------- dragging a plaque ----------
// item.plaqueAt = {dx, dy} in world px, measured from the plaque's default place (the lower right corner of
// the exhibit). It is relative to the exhibit, so the plaque travels with it when the exhibit moves or is
// resized; the site and this editor draw it through the same two custom properties (wall.js makePlaque).
const PLAQUE_MAX = 1500;
function setPlaqueAt(d, dx, dy) {
  const f = v => r2(Math.max(-PLAQUE_MAX, Math.min(PLAQUE_MAX, v)));
  dx = f(dx); dy = f(dy);
  if (dx || dy) d.plaqueAt = { dx, dy }; else delete d.plaqueAt;
}
function startPlaqueDrag(e, pq) {
  e.stopPropagation(); e.preventDefault();               // the camera must not pan
  const id = pq.dataset.pq, d = item(id);
  if (!d) return;
  if (!sel.has(id)) select(id, false); else { primary = id; renderInspector(); markLayers(); }
  const z = camera.zoom(), x0 = e.clientX, y0 = e.clientY;
  const base = d.plaqueAt || { dx: 0, dy: 0 };
  let dx = base.dx, dy = base.dy, moved = false;
  const move = ev => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 3) return;   // a click is not a drag
    moved = true;
    dx = base.dx + (ev.clientX - x0) / z; dy = base.dy + (ev.clientY - y0) / z;
    pq.style.setProperty('--pq-dx', `${dx}px`); pq.style.setProperty('--pq-dy', `${dy}px`);
  };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    if (moved) commit('plaque', () => setPlaqueAt(d, dx, dy));
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
// double click on a plaque: back to its place
function onPlaqueReset(e) {
  const pq = e.target.closest('.plaque[data-pq]');
  const d = pq && item(pq.dataset.pq);
  if (d?.plaqueAt) { e.stopPropagation(); commit('plaque', () => { delete d.plaqueAt; }); }
}
// a click on bare wall (no drag) clears the selection
let downAt = null;
function onDownCapture(e) { downAt = active && !e.target.closest?.('.panel, .tools, .foot, .keys, .modal, .top, .sheet, [data-id], .hd, .front, .cross, .re, .roomv .lab') ? [e.clientX, e.clientY] : null; }
function onUpClear(e) { if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 4 && sel.size && !panMode) select(null); downAt = null; }

// ---------- resizing from any corner (aspect kept, the opposite corner stays) ----------
function startResize(e) {
  e.stopPropagation(); e.preventDefault();
  const h = e.currentTarget.dataset.h, dirX = h.includes('e') ? 1 : -1, dirY = h.includes('s') ? 1 : -1;
  const id = primary, d = item(id), el = elOf(id);
  const box = worldBox(el), z = camera.zoom(), sx = e.clientX, bw = box.x1 - box.x0;
  const origin = el.style.transformOrigin;
  el.style.transformOrigin = `${dirX > 0 ? '0' : '100%'} ${dirY > 0 ? '0' : '100%'}`;
  let s = 1;
  const move = ev => { s = Math.max(0.1, (bw + dirX * (ev.clientX - sx) / z) / bw); el.style.scale = s; };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    el.style.scale = ''; el.style.transformOrigin = origin;
    if (Math.abs(s - 1) < 0.005) return;
    const riders = ridersOf([id]).map(item);
    commit('resize', () => {
      const before = sizeOf(d), bx = d.x, by = d.y;
      if (d.media) d.w = r2(Math.max(10, d.w * s));
      else { d.placeholder.w = Math.round(d.placeholder.w * s); d.placeholder.h = Math.round(d.placeholder.h * s); }
      const after = sizeOf(d);
      d.x = r2(d.x + dirX * (after.w - before.w) / 2);
      // on the cabinet it stands on the board: only the width moves
      if (where(d) === 'wall') d.y = r2(d.y + dirY * (after.h - before.h) / 2);
      // a resized bookcase keeps what stands on it on the same spot of the same shelf
      for (const r of riders) {
        const rh = sizeOf(r).h, fx = (r.x - (bx - before.w / 2)) / before.w, fb = (r.y + rh / 2 - (by - before.h / 2)) / before.h;
        r.x = r2(d.x - after.w / 2 + fx * after.w); r.y = r2(d.y - after.h / 2 + fb * after.h - rh / 2);
      }
    });
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
}
// ---------- rotating with the knob (Shift = whole degrees) ----------
function startRotate(e) {
  e.stopPropagation(); e.preventDefault();
  const d = item(primary), el = elOf(primary), r = el.getBoundingClientRect();
  const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
  const a0 = Math.atan2(e.clientY - cy, e.clientX - cx), rot0 = d.rotation || 0;
  const tilt = el.querySelector('.frame, .piece') || el;
  let rot = rot0;
  const move = ev => {
    const a = Math.atan2(ev.clientY - cy, ev.clientX - cx);
    const lim = d.drawer != null ? 180 : 45; // lying in a drawer a thing may point any way
    rot = Math.max(-lim, Math.min(lim, rot0 + (a - a0) * 180 / Math.PI));
    rot = ev.shiftKey ? Math.round(rot) : Math.round(rot * 10) / 10;
    tilt.style.setProperty('--tilt', `${rot}deg`);
  };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    if (rot !== rot0) commit('rotate', () => { d.rotation = r2(rot); });
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
}

// ---------- keyboard ----------
const isLocked = id => id !== NAMEPLATE && !!item(id)?.locked;
// lock / unlock the selection; with a mixed selection all of them end up locked first
function lockSelected() {
  const ds = [...sel].map(item).filter(Boolean);
  if (!ds.length) return;
  const on = ds.some(d => !d.locked);
  commit('lock', () => { for (const d of ds) { if (on) d.locked = true; else delete d.locked; } });
  markOverlay();   // the handles go (or come back) now, not on the next mouse move
  status('ok', on ? 'Zamčeno – nepohne se myší ani šipkami' : 'Odemčeno');
}
// mirror the selected images left to right; with a mixed selection all of them end up mirrored first
function flipSelected() {
  const ds = [...sel].map(item).filter(d => d?.media);
  if (!ds.length) return;
  const on = ds.some(d => !d.flip);
  commit('flip', () => { for (const d of ds) { if (on) d.flip = true; else delete d.flip; } });
}
const typing = e => e.target.closest?.('input, textarea, select, [contenteditable]');
function onKey(e) {
  if (!active || typing(e) || document.querySelector('.modal, .sheet')) return;
  const mod = e.metaKey || e.ctrlKey;
  let handled = true;
  if (mod && e.key.toLowerCase() === 'z') e.shiftKey ? doRedo() : doUndo();
  else if (mod && e.key.toLowerCase() === 'y') doRedo();
  else if (mod && e.key.toLowerCase() === 'd' && sel.size) duplicate();
  else if (e.key === 'Escape') select(null);
  else if (!mod && e.key.toLowerCase() === 'h' && sel.size) flipSelected();
  else if (!mod && e.key.toLowerCase() === 'l' && sel.size) lockSelected();
  else if ((e.key === 'Backspace' || e.key === 'Delete') && sel.size) removeSelected();
  else if ((e.key === '[' || e.key === ']') && sel.size) {
    commit('rotate', () => { for (const id of sel) { const d = item(id); if (d && !d.locked) { const lim = d.drawer != null ? 180 : 45; d.rotation = r2(Math.max(-lim, Math.min(lim, (d.rotation || 0) + (e.key === ']' ? 0.5 : -0.5)))); } } });
  } else if (e.key.startsWith('Arrow') && sel.size) {
    const step = e.shiftKey ? 10 : 1, k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    commit('nudge', D => {
      for (const id of sel) {
        if (id === NAMEPLATE) { D.nameplate.x += k[0] * step; D.nameplate.y += k[1] * step; continue; }
        const d = item(id);
        if (d.locked) continue;
        if (d.drawer != null) { const dr = W.DRAWERS[d.drawer]; d.dx = r2(Math.min(1, Math.max(0, d.dx + k[0] * step / dr.w))); d.dy = r2(Math.min(1, Math.max(0, d.dy + k[1] * step / dr.h))); }
        else { d.x = r2(d.x + k[0] * step); if (where(d) === 'wall') d.y = r2(d.y + k[1] * step); }
      }
      // what stands on a nudged bookcase moves with it
      for (const id of ridersOf([...sel].filter(i => i !== NAMEPLATE && !isLocked(i)))) { const d = item(id); if (d.locked) continue; d.x = r2(d.x + k[0] * step); d.y = r2(d.y + k[1] * step); }
    });
  } else handled = false;
  // capture phase on window: the camera's own arrow/zoom keys never see what the editor handled
  if (handled) { e.preventDefault(); e.stopImmediatePropagation(); }
}

function removeSelected() {
  const ids = [...sel].filter(id => id !== NAMEPLATE);
  if (!ids.length) return;
  // an exhibit goes to storage with its texts and gallery (Exponáty → Mimo stěnu); a decoration has
  // nothing to lose – its picture stays in the library – so it is simply removed
  // the notices board too: off the wall it keeps its settings and is hung back from Aktuality
  const stored = ids.filter(id => item(id)?.exhibit).length, board = ids.some(id => item(id)?.opens);
  commit('delete', D => {
    D.items = D.items.filter(i => !ids.includes(i.id) || i.exhibit || i.opens);
    for (const i of D.items) if (ids.includes(i.id)) { i.off = true; delete i.sits; }
    // what stood on a removed bookcase stays where it is, standing on nothing
    for (const i of D.items) if (i.sits && ids.includes(i.sits)) delete i.sits;
  });
  select(null);
  status('info', `Sundáno ze stěny: ${ids.length}.` + (board ? ' Tabule s aktualitami pověsíš zpět v Aktualitách.' : '') + (stored ? ` ${stored === 1 ? 'Exponát je' : 'Exponáty jsou'} v Exponátech → Mimo stěnu, i s texty.` : ' Obrázky zůstaly v knihovně.') + ' Vrátíš přes ⌘Z.');
}
function duplicate() {
  const ids = [...sel].filter(id => id !== NAMEPLATE), created = [];
  commit('duplicate', D => {
    for (const id of ids) {
      const c = structuredClone(item(id));
      c.id = uniqueId(id.replace(/-\d+$/, ''));
      delete c.exhibit; // an exhibit has its own address and number; the copy starts as decoration
      if (c.drawer != null) c.dx = r2(Math.min(1, c.dx + 0.1)); else { c.x = r2(c.x + 40); if (where(c) === 'wall') c.y = r2(c.y + 40); }
      D.items.push(c); created.push(c.id);
    }
  });
  sel = new Set(created); primary = created[0] || null; renderInspector(); markLayers(); renderFoot();
}
/** Hangs media items near the centre of the current view (import with „Po importu dát na stěnu“). */
export function placeOnWall(ids) {
  if (!camera || !ids.length) return [];
  const c = camera.toWorld(272 + (innerWidth - 592) / 2, innerHeight / 2), made = [];
  commit('add', D => {
    ids.forEach((mid, k) => {
      const m = D.media[mid]; if (!m) return;
      const id = uniqueId((m.name || 'item').replace(/\.[^.]+$/, ''));
      D.items.push({ id, media: mid, x: r2(c.x + k * 40), y: r2(c.y + k * 40), w: Math.round(Math.max(120, Math.min(400, m.w / 2.5))), rotation: 0 });
      made.push(id);
    });
  });
  if (made.length) { sel = new Set(made); primary = made[0]; renderInspector(); markLayers(); renderFoot(); }
  return made;
}

// ---------- left panel: layers ----------
function layerRow(d) {
  const ex = d.exhibit, m = d.media && D().media[d.media];
  const pre = d.drawer != null ? `<span class="lp">Š${d.drawer + 1}</span>` : `<span class="lt thumb" style="background-image:url('${mediaSrc(d.media)}')"></span>`;
  const tail = (m?.light ? '<span class="sun" title="Svítí">☀</span>' : '') + (ex ? `<span class="invn">${inv(ex.inv)}</span>` : '<span class="lm">dekorace</span>') + (d.locked ? '<span class="lm" title="Zamčená poloha">· zamčeno</span>' : '');
  return `<button class="layer" data-l="${esc(d.id)}">${pre}<span class="ln">${esc(itemName(d))}</span>${tail}</button>`;
}
function renderLayers() {
  const q = ($('#layer-q').value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const match = d => !q || (itemName(d) + ' ' + d.id).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q);
  const items = hung().filter(match);
  const groups = [
    ['Stěna', items.filter(d => where(d) === 'wall'), !q || 'jmenovka'.includes(q)],
    ['Na skříni', items.filter(d => where(d) === 'cabinet')],
    ['Šuplíky', items.filter(d => where(d) === 'drawer').sort((a, b) => a.drawer - b.drawer)],
  ];
  $('#layers').innerHTML = groups.map(([name, list, plate], gi) => {
    const rows = (gi === 0 && plate ? `<button class="layer" data-l="${NAMEPLATE}"><span class="lt" style="background:linear-gradient(135deg,#6e4f17,#e8c66e 30%,#9a7224 60%,#d9b55a)"></span><span class="ln">Jmenovka</span><span class="lm">text</span></button>` : '') + list.map(layerRow).join('');
    return `<div class="lgroup"><span>${name}</span><span>${list.length}</span></div>${rows || '<p class="hint" style="padding:2px 8px">nic</p>'}`;
  }).join('');
  markLayers();
}
function markLayers() {
  $$('#layers .layer').forEach(b => b.classList.toggle('sel', sel.has(b.dataset.l)));
  const p = primary && $(`#layers .layer[data-l="${CSS.escape(primary)}"]`);
  p?.scrollIntoView({ block: 'nearest' });
}

// ---------- left panel: library (drag onto the wall) ----------
function renderLib() {
  const list = Object.entries(D().media).filter(([, m]) => m.kind === 'item').sort((a, b) => (b[1].addedAt || '').localeCompare(a[1].addedAt || ''));
  $('#lib-grid').innerHTML = list.map(([id, m]) =>
    `<div class="t checker ck" draggable="true" data-media="${id}" title="${esc(m.name)}"><img src="${mediaSrc(id)}" alt="" draggable="false"><span>${esc(m.name)}</span></div>`).join('')
    || '<p class="hint">Zatím tu nic není.</p>';
}

// ---------- inspector ----------
const pfx = (k, label, v, attrs = '') => `<label class="pfx"><span>${label}</span><input data-k="${k}" value="${v ?? ''}" inputmode="decimal" ${attrs}></label>`;
function renderInspector() {
  const box = $('#insp');
  if (!sel.size) {
    const n = hung().length, e = hung().filter(i => i.exhibit).length;
    const v = D().view, onAxis = v && Math.abs(v.x - W.CAB.cx) < 0.5;
    box.innerHTML = `<div class="empty-insp"><h2>Nic není vybrané</h2>
      <p class="hint">Klikni na věc na stěně nebo ve Vrstvách vlevo. Novou přidáš přetažením z Knihovny (záložka vlevo) nebo přetažením souborů kamkoli do okna.</p>
      <p class="hint">${n} věcí, z toho ${e} exponátů.</p></div>
      <div class="ibody" style="flex:none;padding-top:0"><div class="card stack">
        <b>Střed stránky</b>
        <p class="hint">Sem se návštěvníkovi otevře pohled. Modrý rámeček ukazuje, co uvidí v okně 1440 × 900; křížek přetáhneš (u osy skříně se přichytí).</p>
        <div class="grid2">${pfx('view.x', 'X', r2(W.START.x))}${pfx('view.y', 'Y', r2(W.START.y))}</div>
        <p class="hint">${!v ? 'Výchozí: nad středem skříně.' : onAxis ? 'Nad středem skříně.' : 'Vlastní.'}</p>
        <div class="row"><button class="btn" data-act="view-axis">Nad střed skříně</button>${v ? '<button class="btn" data-act="view-reset">Výchozí</button>' : ''}</div>
      </div></div>`;
    return;
  }
  if (sel.size > 1) {
    box.innerHTML = `<div class="empty-insp"><h2>${sel.size} vybrané věci</h2>
      <p class="hint">Táhni kteroukoli z nich, pohnou se všechny. Šipky posouvají všechny najednou.</p>
      <div class="stack"><span class="label">Vrstva</span><div class="row fill"><button class="btn" data-act="z-">Dozadu</button><button class="btn" data-act="z+">Dopředu</button></div></div>
      <div class="row"><button class="btn" data-act="lock" title="Zamknout polohu (L)">Zamknout / odemknout</button><button class="btn" data-act="flip" title="Zrcadlit vodorovně (H)">↔ Zrcadlit</button></div>
      <div class="row"><button class="btn danger" data-act="delete">Sundat ze stěny</button></div></div>`;
    return;
  }
  if (primary === NAMEPLATE) {
    box.innerHTML = `<div class="ihead"><span class="thumb" style="background:linear-gradient(135deg,#6e4f17,#e8c66e 30%,#9a7224 60%,#d9b55a)"></span><div style="flex:1;min-width:0"><div class="tt">Jmenovka</div><div class="hint">„${esc(D().settings.plateTitle)}“</div></div></div>
      <div class="ibody"><div class="grid2">${pfx('np.x', 'X', D().nameplate.x)}${pfx('np.y', 'Y', D().nameplate.y)}</div>
      <p class="hint">Nápis změníš v <a href="/#mistnost/jmenovka">Místnost → Jmenovka</a>.</p></div>`;
    return;
  }
  const d = item(primary); if (!d) { select(null); return; }
  const m = d.media && D().media[d.media], ex = d.exhibit, place = where(d);
  const drawers = W.DRAWERS.length;
  const placeTxt = { wall: 'na stěně', cabinet: 'na skříni', drawer: `v šuplíku ${d.drawer + 1}` }[place];
  const tabBtn = (k, label) => `<button role="tab" aria-selected="${tab === k}" data-tab="${k}">${label}</button>`;
  // the plaque is dragged on the wall itself; here only a note and the way back
  const plaqueBlock = ex && ex.plaque !== false && place !== 'drawer'
    ? `<div class="stack"><span class="label">Cedulka${d.plaqueAt ? ` · posunutá ${Math.round(d.plaqueAt.dx)} / ${Math.round(d.plaqueAt.dy)}` : ''}</span>
        <p class="hint">Přetáhni ji myší na stěně, dvojklik ji vrátí na místo. Drží se u exponátu a jezdí s ním.</p>
        ${d.plaqueAt ? '<button class="btn" data-act="pq-reset">Vrátit cedulku na místo</button>' : ''}</div>` : '';
  let body = '';
  if (tab === 'umisteni') {
    const lk = d.locked ? ' disabled' : '';   // locked: the position is shown, not edited
    body = `<div class="stack"><span class="label">Kde je</span>
        <div class="seg">
          <button data-place="wall" aria-pressed="${place === 'wall'}"${lk}>Stěna</button>
          <button data-place="cabinet" aria-pressed="${place === 'cabinet'}"${lk}>Skříň</button>
          <select class="field" data-k="drawer" aria-label="Šuplík"${lk} style="flex:1;${place === 'drawer' ? 'background:var(--seg);color:var(--ink-hi)' : 'background:transparent;border:0;color:var(--ink-mid)'}">
            <option value="">Šuplík ▾</option>${Array.from({ length: drawers }, (_, i) => `<option value="${i}"${d.drawer === i ? ' selected' : ''}>Šuplík ${i + 1}</option>`).join('')}
          </select>
        </div></div>
      <div class="grid2">
        ${place === 'drawer' ? pfx('dx', 'X', d.dx, 'title="V šuplíku, 0–1"' + lk) + pfx('dy', 'Y', d.dy, 'title="V šuplíku, 0–1"' + lk) : pfx('x', 'X', d.x, lk) + (place === 'wall' ? pfx('y', 'Y', d.y, lk) : '<span></span>')}
        ${d.media ? pfx('w', 'Š', d.w, 'title="Šířka ve světě"' + lk) : pfx('ph.w', 'Š', d.placeholder.w, lk)}
        ${pfx('rotation', '∠', d.rotation || 0, 'title="Natočení ve stupních"' + lk)}
      </div>
      <div class="row"><button class="btn" data-act="lock" aria-pressed="${!!d.locked}" title="Zamknout polohu – nepohne se myší ani šipkami (L)">${d.locked ? 'Zamčeno · odemknout' : 'Zamknout polohu'}</button>${d.media ? `<button class="btn" data-act="flip" aria-pressed="${!!d.flip}" title="Zrcadlit vodorovně (H)">↔ Zrcadlit${d.flip ? ' · zrcadleno' : ''}</button>` : ''}</div>
      <div class="stack"><span class="label">Vrstva${d.z ? ` · ${d.z}` : ''}</span><div class="row fill"><button class="btn" data-act="z-">Dozadu</button><button class="btn" data-act="z+">Dopředu</button></div></div>${plaqueBlock}`;
  } else if (tab === 'vzhled') {
    body = `<div class="stack"><span class="label">Obrázek</span>
        <div class="row"><span class="checker thumb ck" style="width:64px;height:52px;border-radius:6px"><img src="${mediaSrc(d.media)}" alt=""></span>
        <div style="flex:1;min-width:0"><div style="overflow:hidden;text-overflow:ellipsis">${esc(m?.name || '—')}</div><div class="hint">${m ? `${m.w} × ${m.h}${m.alpha ? ' · průhlednost' : ''}` : ''}</div></div></div>
        <button class="btn" data-act="swap">Zaměnit obrázek…</button></div>
      ${d.media ? `<div class="stack"><span class="label">Otvor</span>
        <p class="hint">${d.opening ? `${d.opening.shape === 'oval' ? 'Ovál' : 'Obdélník'} ${Math.round(d.opening.w * 100)} × ${Math.round(d.opening.h * 100)} % obrázku – z něj se počítá stín rámu uvnitř obrazu.` : 'Nenakreslený. Kresli ho u obrazů v rámu, je z něj stín rámu uvnitř obrazu.'}</p>
        <button class="btn" data-act="opening">Nakreslit otvor…</button></div>
      <div class="stack"><span class="label">Police</span>
        <p class="hint">${m?.shelves?.length ? `${m.shelves.length} ${m.shelves.length < 5 ? 'police' : 'polic'} – věc přetažená na polici se přichytí a jezdí pak s knihovnou. Platí pro všechny kopie tohohle obrázku.` : 'Žádné. U knihovny nakresli police, věci se na ně pak dají postavit.'}${d.sits ? '<br>Tahle věc stojí na polici – jezdí s ní.' : ''}</p>
        <button class="btn" data-act="shelves">Nakreslit police…</button></div>
      <div class="stack"><span class="label">Světlo</span>
        <p class="hint">${m?.light ? `☀ Svítí – plamen ${m.light.x} / ${m.light.y}, dosah ${m.light.radius}. Platí pro všechny kopie tohohle obrázku.` : 'Nesvítí.'}</p>
        <a href="/#knihovna/${d.media}">Nastavit světlo v Knihovně →</a></div>` : ''}`;
  } else {
    const onWall = d.drawer == null && !d.on;
    body = `<label class="check"><input type="checkbox" data-k="exhibit"${ex ? ' checked' : ''}${d.opens ? ' disabled' : ''}> Je to exponát (otevře se, má štítek s číslem)</label>
      <label class="check"><input type="checkbox" data-k="opens"${d.opens ? ' checked' : ''}${ex || !onWall ? ' disabled' : ''}> Otevírá aktuality (tabule)</label>
      ${d.opens ? '<p class="hint">Klik na tuhle věc otevře tabuli s aktualitami; kopie visí i vedle dveří. Zápisy píšeš v Aktualitách.</p>' : ''}
      ${ex ? `<div class="grid2">${pfx('ex.inv', 'Č.', ex.inv, 'title="Inventární číslo"')}<label class="pfx" style="grid-column:span 1"><span>/e/</span><input data-k="ex.slug" value="${esc(ex.slug)}" title="Adresa exponátu"></label></div>
        <p class="hint">Texty a galerii píšeš v Exponátech.</p>` : d.opens ? '' : '<p class="hint">Dekorace se na webu neotvírá a nemá štítek.</p>'}`;
  }
  const summary = ex ? (() => {
    const miss = missing(ex), gal = (ex.gallery || []).filter(g => D().media[g]).length;
    return `<div class="card stack"><div class="row" style="justify-content:space-between"><b>Obsah exponátu</b>${miss.length ? `<span class="warn">chybí ${miss.length}</span>` : '<span class="okc">kompletní</span>'}</div>
      <div class="sumlist">
        <span>${ex.title && ex.medium && ex.description ? '✓' : '<span class="warn">✗</span>'} Název, technika, popis</span>
        <span>${gal ? `✓ ${gal} ${gal === 1 ? 'fotka' : gal < 5 ? 'fotky' : 'fotek'} v galerii` : '<span class="warn">✗</span> Žádné fotky v galerii'}</span>
        <span>${ex.plaque !== false ? '✓ Mosazný štítek' : '– Bez štítku'}</span>
      </div>
      <a href="/#exponaty/${encodeURIComponent(ex.slug)}" style="font-weight:500">Upravit obsah v Exponátech →</a></div>`;
  })() : '';
  box.innerHTML = `
    <div class="ihead"><span class="checker thumb ck"><img src="${mediaSrc(d.media)}" alt=""></span>
      <div style="flex:1;min-width:0"><div class="tt">${esc(itemName(d))}</div><div class="hint">${esc(m?.name || 'malba')} · ${placeTxt}</div></div>
      ${ex ? `<span class="badge">${inv(ex.inv)}</span>` : ''}</div>
    <div class="tabs" role="tablist" style="padding:8px 12px 0">${tabBtn('umisteni', 'Umístění')}${tabBtn('vzhled', 'Vzhled')}${tabBtn('exponat', 'Exponát')}</div>
    <div class="ibody">${body}${summary}
      <div class="row"><button class="btn" data-act="swap">Zaměnit obrázek…</button><button class="btn" data-act="duplicate">Duplikovat</button><button class="btn danger" data-act="delete">Sundat ze stěny</button></div>
    </div>`;
}

function onInspChange(e) {
  const k = e.target.dataset.k; if (!k) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (k.startsWith('view.')) { const n = Number(String(v).replace(',', '.')); if (Number.isFinite(n)) commit('view', D => { D.view = { ...W.START, [k.slice(5)]: r2(n) }; }); return; }
  if (primary === NAMEPLATE) { const n = Number(String(v).replace(',', '.')); if (Number.isFinite(n)) commit('np', D => { D.nameplate[k.slice(3)] = r2(n); }); return; }
  const d = item(primary);
  const n = () => { const x = Number(String(v).replace(',', '.').replace('−', '-').replace('°', '')); if (v === '' || !Number.isFinite(x)) throw new Error('Čekám číslo'); return r2(x); };
  try {
    commit('field:' + k, () => {
      if (k === 'ph.w') { const s = n() / d.placeholder.w; d.placeholder.w = Math.round(d.placeholder.w * s); d.placeholder.h = Math.round(d.placeholder.h * s); }
      else if (['x', 'y', 'w', 'rotation', 'dx', 'dy'].includes(k)) d[k] = n();
      else if (k === 'drawer') { if (v !== '') moveTo(d, Number(v)); }
      // one board at most: switching it on here switches it off wherever it was
      else if (k === 'opens') { for (const i of D().items) if (i.opens && i !== d) delete i.opens; if (v) d.opens = 'notices'; else delete d.opens; }
      else if (k === 'exhibit') {
        if (v) d.exhibit = { slug: uniqueSlug(d.id), inv: nextInv(), title: itemName(d), medium: '', description: '', tags: [], gallery: [], plaque: true };
        else delete d.exhibit;
      } else if (k === 'ex.inv') d.exhibit.inv = n();
      else if (k === 'ex.slug') d.exhibit.slug = String(v).trim();
    });
  } catch (err) { status('err', err.message); renderInspector(); }
}
function moveTo(d, place) {
  const before = where(d);
  if (place === 'wall') {
    if (before === 'drawer') { d.x = r2(W.CAB.cx); d.y = r2(W.CAB.top - 400); }
    else if (before === 'cabinet') d.y = r2(W.CAB.top - sizeOf(d).h / 2 - 60);
    delete d.on; delete d.drawer; delete d.dx; delete d.dy;
  } else if (place === 'cabinet') {
    if (before === 'drawer') d.x = r2(W.CAB.cx);
    d.on = 'cabinet'; d.y = r2(W.CAB.top - sizeOf(d).h / 2); delete d.drawer; delete d.dx; delete d.dy;
  } else {
    d.drawer = place; d.dx = d.dx ?? 0.5; d.dy = d.dy ?? 0.45; delete d.on; delete d.x; delete d.y;
    openDrawer(place);
  }
}
async function onInspClick(e) {
  const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; renderInspector(); return; }
  const p = e.target.closest('[data-place]'); if (p) { const d = item(primary); if (where(d) !== p.dataset.place) commit('place', () => moveTo(d, p.dataset.place)); return; }
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'view-axis') return commit('view', D => { D.view = { x: r2(W.CAB.cx), y: r2(W.START.y) }; });
  if (act === 'view-reset') return commit('view', D => { D.view = null; });
  if (act === 'delete') return removeSelected();
  if (act === 'duplicate') return duplicate();
  if (act === 'opening') return openOpening(item(primary));
  if (act === 'shelves') return openShelves(item(primary).media);
  if (act === 'pq-reset') return commit('plaque', () => { for (const id of sel) { const d = item(id); if (d) delete d.plaqueAt; } });
  if (act === 'flip') return flipSelected();
  if (act === 'lock') return lockSelected();
  if (act === 'z+' || act === 'z-') return commit('z', () => { for (const id of sel) { const d = item(id); if (d) { d.z = (d.z || 0) + (act === 'z+' ? 1 : -1); if (!d.z) delete d.z; } } });
  if (act === 'swap') {
    const d = item(primary);
    const id = await pickMedia({ title: 'Zaměnit obrázek', kinds: ['item'], current: d.media });
    if (!id || id === d.media) return;
    // the width stays, the height follows the new picture's proportions
    commit('swap', () => { if (!d.media) { const s = sizeOf(d); d.w = r2(s.w); delete d.placeholder; } d.media = id; delete d.opening; });
  }
}

function renderFoot() {
  const n = hung().length, e = hung().filter(i => i.exhibit).length, off = D().items.filter(i => i.off).length;
  $('#f-count').textContent = `${n} věcí · ${e} exponátů` + (off ? ` · ${off} ve skladu` : '');
  $('#f-sel').textContent = `Vybráno: ${sel.size}`;
}

// ---------- opening (where the picture sits inside the frame) ----------
function openOpening(d) {
  const m = D().media[d.media];
  const dlg = document.createElement('div');
  dlg.className = 'modal';
  dlg.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-label="Otvor">
    <div class="modal-head"><h2>Otvor – kde je obraz v rámu</h2><button class="icon-btn" data-x aria-label="Zavřít">×</button></div>
    <p class="hint">Tažením nakresli, kde je samotný obraz. Použije se pro stín rámu uvnitř obrazu.</p>
    <div class="row"><span class="label">Tvar</span><div class="seg" style="flex:none"><button data-shape="rect" aria-pressed="true">Obdélník</button><button data-shape="oval" aria-pressed="false">Ovál</button></div></div>
    <div class="op-stage"><img alt="" src="${mediaSrc(d.media, m.widths[m.widths.length - 1])}"><div class="op-box" hidden></div></div>
    <div class="row"><button class="btn primary" data-save>Uložit</button><button class="btn" data-clear>Smazat otvor</button><button class="btn" data-x>Zrušit</button></div>
  </div>`;
  let rect = d.opening ? { ...d.opening } : null, shape = d.opening?.shape || 'rect';
  const img = $('img', dlg), box = $('.op-box', dlg);
  const draw = () => {
    $$('[data-shape]', dlg).forEach(b => b.setAttribute('aria-pressed', b.dataset.shape === shape));
    if (!rect) { box.hidden = true; return; }
    const w = img.clientWidth, h = img.clientHeight;
    box.hidden = false; box.className = 'op-box' + (shape === 'oval' ? ' oval' : '');
    box.style.cssText = `left:${rect.x * w}px;top:${rect.y * h}px;width:${rect.w * w}px;height:${rect.h * h}px`;
  };
  img.onload = draw;
  const close = () => dlg.remove();
  dlg.addEventListener('click', e => {
    if (e.target === dlg || e.target.closest('[data-x]')) return close();
    const s = e.target.closest('[data-shape]'); if (s) { shape = s.dataset.shape; draw(); }
    if (e.target.closest('[data-clear]')) { close(); commit('opening', () => { delete d.opening; }); }
    if (e.target.closest('[data-save]')) {
      close();
      if (!rect || rect.w < 0.02 || rect.h < 0.02) return status('err', 'Otvor je moc malý, nic jsem neuložil.');
      const f = v => Math.round(v * 10000) / 10000;
      commit('opening', () => { d.opening = { shape, x: f(rect.x), y: f(rect.y), w: f(Math.min(rect.w, 1 - rect.x)), h: f(Math.min(rect.h, 1 - rect.y)) }; });
    }
  });
  $('.op-stage', dlg).addEventListener('pointerdown', e => {
    const rc = img.getBoundingClientRect();
    const fx = x => Math.min(1, Math.max(0, (x - rc.left) / rc.width)), fy = y => Math.min(1, Math.max(0, (y - rc.top) / rc.height));
    const x0 = fx(e.clientX), y0 = fy(e.clientY);
    const move = ev => { const x1 = fx(ev.clientX), y1 = fy(ev.clientY); rect = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }; draw(); };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });
  stopPointer(dlg);
  document.body.appendChild(dlg);
  draw();
}

// ---------- section life cycle ----------
export function init() {
  decorSvgs();
  rebuild();
  // „Celá stěna“ / 0: the whole room (fixed or grown) between the side panels and the top bar
  const fitBox = () => { const r = roomNow(); return { box: { x0: r.x0, x1: r.x1, y0: r.y0, y1: W.CUT_Y }, m: { l: 300, r: 270, t: 110, b: 60 } }; };
  camera = startCamera({ world: world(), ...W, WALL: expanded(W.WALL), ui, dark: false, zFloor: 0.15, fitBox });
  world().addEventListener('pointerdown', onWorldDown);
  world().addEventListener('dblclick', onPlaqueReset);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointerdown', onDownCapture, true);
  addEventListener('pointerup', onUpClear);
  addEventListener('keydown', onKey, true);
  $('#insp').addEventListener('change', onInspChange);
  $('#insp').addEventListener('click', onInspClick);
  // panels, toolbars and the status bar keep the pointer and the wheel to themselves (the camera
  // listens on body/window; a drag that reached it would pan the wall and swallow the next click)
  $$('#sec-stena .panel, #sec-stena .tools, #sec-stena .foot, #sec-stena .keys, .top').forEach(stopPointer);

  // left panel
  $$('.ptabs [data-ptab]').forEach(b => b.addEventListener('click', () => {
    $$('.ptabs [data-ptab]').forEach(x => x.setAttribute('aria-selected', x === b));
    $$('#sec-stena [data-pane]').forEach(p => { p.hidden = p.dataset.pane !== b.dataset.ptab; });
    if (b.dataset.ptab === 'lib') renderLib();
  }));
  $('#layer-q').addEventListener('input', renderLayers);
  $('#layers').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) e.shiftKey ? select(b.dataset.l, true) : reveal(b.dataset.l); });
  $('#lib-grid').addEventListener('dragstart', e => {
    const t = e.target.closest('[data-media]'); if (!t) return;
    e.dataTransfer.setData('text/kabinet-media', t.dataset.media); e.dataTransfer.effectAllowed = 'copy';
  });
  $('#lib-import').addEventListener('click', () => openImport(null, { kind: 'item', place: true }));
  // library → wall. The drop position is taken from the last dragover: some browsers report the drop
  // event's own coordinates unreliably (seen in the embedded test browser).
  let overAt = null;
  addEventListener('dragover', e => { if (active && e.dataTransfer.types.includes('text/kabinet-media')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; overAt = [e.clientX, e.clientY]; } });
  addEventListener('drop', e => {
    const mid = e.dataTransfer.getData('text/kabinet-media'); if (!mid || !active) return;
    e.preventDefault();
    const [cx, cy] = overAt || [e.clientX, e.clientY]; overAt = null;
    if (document.elementFromPoint(cx, cy)?.closest('.panel, .tools, .foot')) return; // dropped back onto a panel
    const m = D().media[mid], p = camera.toWorld(cx, cy);
    const id = uniqueId((m.name || 'item').replace(/\.[^.]+$/, ''));
    commit('add', D => { D.items.push({ id, media: mid, x: r2(p.x), y: r2(p.y), w: Math.round(Math.max(120, Math.min(400, m.w / 2.5))), rotation: 0 }); });
    select(id, false);
  });

  // tools
  const setPan = v => { panMode = v; $('#t-pan').setAttribute('aria-pressed', v); $('#t-select').setAttribute('aria-pressed', !v); document.body.classList.toggle('pan', v); };
  $('#t-select').addEventListener('click', () => setPan(false));
  $('#t-pan').addEventListener('click', () => setPan(true));
  $('#t-snap').addEventListener('click', () => { snapOn = !snapOn; $('#t-snap').setAttribute('aria-pressed', snapOn); });
  $('#t-dark').addEventListener('click', () => {
    const v = $('#t-dark').getAttribute('aria-pressed') !== 'true';
    $('#t-dark').setAttribute('aria-pressed', v); camera.setDark(v); document.body.classList.toggle('dark-preview', v);
  });
  $('#t-start').addEventListener('click', () => { const v = $('#t-start').getAttribute('aria-pressed') !== 'true'; $('#t-start').setAttribute('aria-pressed', v); document.body.classList.toggle('no-start', !v); });
  $('#overlay .cross').addEventListener('pointerdown', onCrossDown);
  $('#t-room').addEventListener('click', () => { const v = $('#t-room').getAttribute('aria-pressed') !== 'true'; $('#t-room').setAttribute('aria-pressed', v); document.body.classList.toggle('show-room', v); });
  $('#overlay .roomv').addEventListener('pointerdown', onRoomDown);
  $('#overlay .roomv .auto').addEventListener('pointerdown', e => e.stopPropagation());
  $('#overlay .roomv .auto').addEventListener('click', () => commit('room', D => { D.room = null; }));
  $('#t-zin').addEventListener('click', () => camera.zoomBy(1.2));
  $('#t-zout').addEventListener('click', () => camera.zoomBy(1 / 1.2));
  $('#t-fit').addEventListener('click', () => camera.fitAll());
  $('#keys-btn').addEventListener('click', e => { e.preventDefault(); $('#keys').hidden = !$('#keys').hidden; });

  // the overlay is redrawn only when the view moved or something may have changed (stena drawOverlay)
  for (const t of ['pointerdown', 'pointerup', 'keydown', 'wheel', 'click', 'resize']) addEventListener(t, markOverlay, { capture: true, passive: true });
  addEventListener('pointermove', e => { if (e.buttons) markOverlay(); }, { capture: true, passive: true });
  on('layout', rebuild);
  on('data', rebuild);
  requestAnimationFrame(drawOverlay);
}

export function show(arg) {
  active = true; ui.viewerOpen = false;
  camera.invalidate();
  if (arg && arg !== primary && (arg === NAMEPLATE || (item(arg) && !item(arg).off))) reveal(arg);
}
export function hide() {
  active = false; ui.viewerOpen = true;
  $('#keys').hidden = true;
}
