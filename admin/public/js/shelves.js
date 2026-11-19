// Rectangles drawn on a picture, in fractions of it: bookcase shelves (Stěna inspector and Knihovna) and the
// opening in the door casing (Místnost → Úvodní dveře). Drag on the picture = a new one, drag a drawn one to
// move it, its four corners resize it (the opposite corner stays), the arrows nudge it, ⌫ deletes it.
// Shelves: their bottom edges are where things are put down on the wall; they belong to the image, so
// every copy of the bookcase – and every bookcase made from the same picture – has them.

import { $, $$, esc, store, api, status, refresh, mediaSrc, stopPointer } from './core.js';

const clamp01 = (v, max = 1) => Math.min(max, Math.max(0, v));
const r4 = v => Math.round(v * 10000) / 10000;

/**
 * The drawing dialog. `single`: only one rectangle (a new drag replaces it). `count(n)` labels the total.
 * Resolves with the rectangles, or null when cancelled.
 */
export function rectDialog({ title, hint, src, rects = [], single = false, count = n => String(n) }) {
  return new Promise(resolve => {
    let list = rects.map(s => ({ ...s })), picked = single && list.length ? 0 : -1;
    const dlg = document.createElement('div');
    dlg.className = 'modal';
    dlg.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-x aria-label="Zavřít">×</button></div>
      <p class="hint">${hint}</p>
      <div class="op-stage shelves-stage"><img alt="" src="${src}"></div>
      <div class="row"><button class="btn primary" data-save>Uložit</button>${single ? '' : '<button class="btn" data-del disabled>Smazat vybranou</button>'}<button class="btn" data-clear>${single ? 'Smazat' : 'Smazat všechny'}</button><span class="hint" data-count></span><span style="flex:1"></span><button class="btn" data-x>Zrušit</button></div>
    </div>`;
    const stage = $('.shelves-stage', dlg), img = $('img', stage);
    const draw = () => {
      $$('.op-box', stage).forEach(b => b.remove());
      const w = img.clientWidth, h = img.clientHeight;
      list.forEach((s, i) => {
        const b = document.createElement('div');
        b.className = 'op-box shelf' + (i === picked ? ' on' : ''); b.dataset.i = i;
        b.style.cssText = `left:${s.x * w}px;top:${s.y * h}px;width:${s.w * w}px;height:${s.h * h}px`;
        b.innerHTML = (single ? '' : `<span>${i + 1}</span>`) + (i === picked ? ['nw', 'ne', 'sw', 'se'].map(k => `<b class="rz ${k}" data-rz="${k}"></b>`).join('') : '');
        stage.appendChild(b);
      });
      const del = $('[data-del]', dlg); if (del) del.disabled = picked < 0;
      $('[data-count]', dlg).textContent = single ? '' : count(list.length);
    };
    img.onload = draw;
    const done = v => { dlg.remove(); removeEventListener('keydown', key, true); resolve(v); };
    const key = e => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); done(null); }
      if ((e.key === 'Backspace' || e.key === 'Delete') && picked >= 0) { e.preventDefault(); e.stopImmediatePropagation(); list.splice(picked, 1); picked = -1; draw(); }
      const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (k && picked >= 0) {
        e.preventDefault(); e.stopImmediatePropagation();
        const s = list[picked], step = (e.shiftKey ? 10 : 1) / img.clientWidth;   // 1 px of the picture (10 with Shift)
        s.x = clamp01(s.x + k[0] * step, 1 - s.w); s.y = clamp01(s.y + k[1] * step * img.clientWidth / img.clientHeight, 1 - s.h); draw();
      }
    };
    dlg.addEventListener('click', e => {
      if (e.target === dlg || e.target.closest('[data-x]')) return done(null);
      if (e.target.closest('[data-del]') && picked >= 0) { list.splice(picked, 1); picked = -1; return draw(); }
      if (e.target.closest('[data-clear]')) { list = []; picked = -1; return draw(); }
      if (e.target.closest('[data-save]')) done(list.map(s => ({ x: r4(s.x), y: r4(s.y), w: r4(Math.min(s.w, 1 - s.x)), h: r4(Math.min(s.h, 1 - s.y)) })));
    });
    stage.addEventListener('pointerdown', e => {
      e.preventDefault();
      const rc = img.getBoundingClientRect();
      const hit = e.target.closest('.op-box');
      if (hit) {
        // on a drawn one: select it, and drag moves it – or, on a corner of the picked one, resizes it
        picked = Number(hit.dataset.i);
        const s = list[picked], o = { ...s }, rz = e.target.closest('[data-rz]')?.dataset.rz;
        const px = e.clientX, py = e.clientY;
        draw();
        const move = ev => {
          const dx = (ev.clientX - px) / rc.width, dy = (ev.clientY - py) / rc.height, MIN = 0.01;
          if (!rz) { s.x = clamp01(o.x + dx, 1 - o.w); s.y = clamp01(o.y + dy, 1 - o.h); }
          else {
            if (rz.includes('w')) { const x = Math.min(clamp01(o.x + dx), o.x + o.w - MIN); s.w = o.x + o.w - x; s.x = x; }
            else s.w = Math.max(MIN, Math.min(o.w + dx, 1 - o.x));
            if (rz.includes('n')) { const y = Math.min(clamp01(o.y + dy), o.y + o.h - MIN); s.h = o.y + o.h - y; s.y = y; }
            else s.h = Math.max(MIN, Math.min(o.h + dy, 1 - o.y));
          }
          draw();
        };
        const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
        addEventListener('pointermove', move); addEventListener('pointerup', up);
        return;
      }
      const fx = x => clamp01((x - rc.left) / rc.width), fy = y => clamp01((y - rc.top) / rc.height);
      const x0 = fx(e.clientX), y0 = fy(e.clientY), s = { x: x0, y: y0, w: 0, h: 0 }, prev = list;
      if (single) list = [];
      list.push(s); picked = list.length - 1;
      const move = ev => { const x1 = fx(ev.clientX), y1 = fy(ev.clientY); Object.assign(s, { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }); draw(); };
      const up = () => {
        removeEventListener('pointermove', move); removeEventListener('pointerup', up);
        // a click, not a drag: nothing new (and in single mode the old one comes back)
        if (s.w < 0.01 || s.h < 0.01) { if (single) { list = prev; picked = list.length ? 0 : -1; } else { list.pop(); picked = -1; } }
        draw();
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    });
    stopPointer(dlg);
    document.body.appendChild(dlg);
    addEventListener('keydown', key, true);
    draw();
  });
}

/** Shelves of bookcase image `id`. */
export async function openShelves(id) {
  const m = store.D.media[id];
  if (!m) return;
  const list = await rectDialog({
    title: `Police – ${m.name}`, src: mediaSrc(id, m.widths[m.widths.length - 1]), rects: m.shelves || [],
    hint: 'Tažením po obrázku nakresli každou polici: rámeček přes prostor, kam se věci postaví. Jeho <b>spodní hrana</b> je místo, kam se věc na stěně přichytí. Hotovou polici přetáhneš, rohy změníš její velikost, šipky ji posunou (se Shiftem víc), ⌫ ji smaže.',
    count: n => n ? `${n} ${n < 5 ? 'police' : 'polic'}` : 'zatím žádná',
  });
  if (!list) return;
  try {
    status('saving');
    await api('PATCH', `/api/media/${id}`, { shelves: list });
    await refresh(); status('ok', list.length ? `Police uložené (${list.length})` : 'Police smazané');
  } catch (err) { status('err', err.message); }
}
