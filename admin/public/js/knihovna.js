// Section 3 · Knihovna (phase 3b; replaces the tabs Import + Knihovna): every image and sound, where it
// is used, its look, light and file – and the import sheet that opens when files are dropped anywhere.

import { $, $$, esc, store, on, api, status, refresh, mediaSrc, usage, stopPointer, commit } from './core.js';
import { openShelves } from './shelves.js';
import { placeOnWall } from './stena.js';

const root = () => $('#sec-knihovna');
const D = () => store.D;
let filter = 'all', q = '', selected = null, pop = null;
// several at once (⌘/Ctrl-click toggles, Shift-click a range, „Vybrat vše zobrazené“): bulk delete
let multi = new Set(), anchor = null, shown = [];
const GROUPS = {
  all: ['Vše', () => true],
  item: ['Věci na stěnu', m => m.kind === 'item'],
  gallery: ['Fotky do galerií', m => m.kind === 'gallery'],
  wall: ['Tapeta a špína', m => m.kind === 'tile' || m.kind === 'grime'],
  cabinet: ['Skříň', m => ['cabinet', 'drawer', 'tray'].includes(m.kind)],
  doors: ['Dveře', m => m.kind === 'doors'],
  plate: ['Cedulky', m => m.kind === 'plate'],
  surround: ['Obložení', m => m.kind === 'surround'],
  sound: ['Zvuky', m => m.kind === 'sound'],
};
const kindLabel = k => store.S.kinds[k]?.label || (k === 'sound' ? 'Zvuk' : k);
const lookName = id => !id ? 'bez looku' : (store.S.looks.find(l => l.id === id)?.name || id);
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const mb = b => (b / 1048576).toLocaleString('cs', { maximumFractionDigits: 1 }) + ' MB';

// ---------- the grid ----------
function render() {
  const all = Object.entries(D().media);
  const unused = ([id]) => !usage(id).length;
  let list = filter === 'unused' ? all.filter(unused) : all.filter(([, m]) => GROUPS[filter][1](m));
  if (q) list = list.filter(([id, m]) => fold(m.name + ' ' + id).includes(fold(q)));
  list.sort((a, b) => (b[1].addedAt || '').localeCompare(a[1].addedAt || ''));
  shown = list.map(([id]) => id);
  const bytes = all.reduce((s, [, m]) => s + (m.bytes || 0), 0);
  const chips = Object.entries(GROUPS).map(([k, [label, f]]) => `<button class="chip" data-f="${k}" aria-pressed="${filter === k}">${label}${k === 'all' ? '' : ' ' + all.filter(([, m]) => f(m)).length}</button>`).join('')
    + `<span style="width:1px;background:var(--line2);margin:0 4px"></span><button class="chip amber" data-f="unused" aria-pressed="${filter === 'unused'}">Nepoužité ${all.filter(unused).length}</button>`;
  const cards = list.map(([id, m]) => {
    const n = usage(id).length;
    return `<figure data-id="${id}" class="${id === selected || multi.has(id) ? 'on' : ''}">
      ${m.kind === 'sound' ? '<div class="thumb checker snd" aria-hidden="true">♪</div>' : `<div class="thumb checker ck"><img src="${mediaSrc(id)}" alt=""></div>`}
      <figcaption><span class="nm" title="${esc(m.name)}">${esc(m.name)}${m.light ? ' <span class="warn" title="Svítí">☀</span>' : ''}</span><span class="${n ? 'hint' : 'warn'}" style="flex:none">${n ? n + '×' : 'nepoužito'}</span></figcaption>
    </figure>`;
  }).join('') || '<p class="hint">Nic takového tu není.</p>';
  // the whole section is re-rendered on every click; .lib-main is the scroller, so keep its position
  // (a selection in the middle of the library jumped the page back to the top)
  const keep = $('.lib-main', root())?.scrollTop || 0;
  root().innerHTML = `<main class="lib-main" aria-label="Knihovna">
    <div class="row" style="gap:12px">
      <h1 style="margin:0;font-size:16px;font-weight:600">Knihovna <span class="hint" style="font-size:13px;font-weight:400">· ${all.length} souborů · ${mb(bytes)} na webu</span></h1>
      <span style="flex:1"></span>
      <label class="search" style="width:220px"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg><input id="lib-q" placeholder="Hledat" aria-label="Hledat v knihovně" value="${esc(q)}"></label>
      <button class="btn" data-act="select-shown" title="Vybere všechno, co je teď zobrazené (třeba s filtrem Nepoužité)">Vybrat vše zobrazené</button>
      <button class="btn primary" data-act="import">Importovat…</button>
    </div>
    <div class="row">${chips}</div>
    <div class="lib-cards">${cards}</div>
    ${multi.size > 1 ? bulk() : selected && D().media[selected] ? detail(selected) : ''}
  </main>`;
  if (keep) $('.lib-main', root()).scrollTop = keep;
}

function bulk() {
  const ids = [...multi].filter(id => D().media[id]), free = ids.filter(id => !usage(id).length);
  const bytes = ids.reduce((s, id) => s + (D().media[id].bytes || 0), 0);
  return `<div class="detail" aria-label="Vybrané soubory">
    <strong>${ids.length} vybráno</strong>
    <span class="hint" style="font-size:13px">${mb(bytes)} · ${free.length === ids.length ? 'nic z toho se nepoužívá' : `<span class="warn">${ids.length - free.length} se používá</span> – ty se nesmažou`}</span>
    <span class="hint" style="font-size:13px">⌘-klik přidá nebo odebere, Shift-klik vybere rozsah</span>
    <span style="flex:1"></span>
    <button class="btn" data-act="clear-multi">Zrušit výběr</button>
    <button class="btn danger" data-act="bulk-delete"${free.length ? '' : ' disabled'}>Smazat ${free.length ? `nepoužité (${free.length})` : ''}</button>
  </div>`;
}

function detail(id) {
  const m = D().media[id], used = usage(id);
  const info = m.kind === 'sound' ? `${Math.round(m.bytes / 1024)} kB` : `${m.w} × ${m.h}${m.alpha ? ' · průhlednost' : ''} · ${esc(lookName(m.look))}`;
  return `<div class="detail" aria-label="Vybraný soubor">
    <strong>${esc(m.name)}</strong>
    <span class="hint" style="font-size:13px">${esc(kindLabel(m.kind))} · ${info}</span>
    <span class="hint" style="font-size:13px">${used.length ? 'Použito: ' + used.map(([l, h]) => `<a href="/${h}">${esc(l)}</a>`).join(', ') : '<span class="warn">Nepoužito</span>'}</span>
    ${m.kind === 'sound' ? `<audio controls preload="none" src="/media/${id}/sound${m.ext}?v=${m.v || 1}" style="height:32px"></audio>` : ''}
    <span style="flex:1"></span>
    ${m.kind !== 'sound' ? '<button class="btn" data-act="look">Změnit look…</button>' : ''}
    ${m.kind === 'item' ? '<button class="btn" data-act="light">Nastavit světlo…</button>' : ''}
    ${m.kind === 'item' ? `<button class="btn" data-act="shelves">Police${m.shelves?.length ? ` (${m.shelves.length})` : ''}…</button>` : ''}
    <label class="btn">Nahradit soubor…<input type="file" data-replace hidden></label>
    ${used.length ? '' : '<button class="btn danger" data-act="delete">Smazat</button>'}
    ${pop === 'look' ? lookPop(m) : pop === 'light' ? lightPop(m) : ''}
  </div>`;
}
const lookPop = m => `<div class="pop" style="flex-basis:100%"><div class="row">
  <select class="field" id="lk">${['', ...store.S.looks.map(l => l.id)].map(id => `<option value="${esc(id)}"${(m.look || '') === id ? ' selected' : ''}>${esc(lookName(id))}</option>`).join('')}</select>
  <button class="btn primary" data-act="look-save">Přepočítat</button><button class="btn" data-act="close-pop">Zrušit</button>
  <span class="hint">Přepočítá se z uloženého originálu, všude kde se obrázek používá.</span></div></div>`;
const lightPop = m => { const l = m.light || {}; return `<div class="pop" style="flex-basis:100%"><div class="row">
  <label class="pfx" style="width:150px"><span style="width:auto">Plamen X</span><input id="lx" value="${l.x ?? 0.5}"></label>
  <label class="pfx" style="width:150px"><span style="width:auto">Plamen Y</span><input id="ly" value="${l.y ?? 0.15}"></label>
  <label class="pfx" style="width:150px"><span style="width:auto">Dosah</span><input id="lr" value="${l.radius ?? 340}"></label>
  <button class="btn primary" data-act="light-save">Uložit</button>${m.light ? '<button class="btn" data-act="light-off">Nesvítí</button>' : ''}<button class="btn" data-act="close-pop">Zrušit</button></div>
  <p class="hint">Pozice plamene 0–1 v obrázku (0,5 / 0,15 = uprostřed, kousek pod horním okrajem). Dosah v px stěny: 340 svíčka, 500+ lampa.</p></div>`; };

async function onClick(e) {
  const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; return render(); }
  const fig = e.target.closest('figure[data-id]');
  if (fig) {
    const id = fig.dataset.id;
    pop = null;
    if (e.metaKey || e.ctrlKey) {            // toggle one in the selection
      if (!multi.size && selected) multi.add(selected);
      multi.has(id) ? multi.delete(id) : multi.add(id); anchor = id;
    } else if (e.shiftKey && (anchor || selected)) {   // a range in the order shown
      const a = shown.indexOf(anchor || selected), b = shown.indexOf(id);
      if (!multi.size && selected) multi.add(selected);
      for (const x of shown.slice(Math.min(a, b), Math.max(a, b) + 1)) multi.add(x);
    } else {
      multi.clear(); anchor = id;
      selected = id === selected ? null : id;
    }
    if (multi.size === 1) { selected = [...multi][0]; multi.clear(); }
    else if (multi.size > 1) selected = null;
    history.replaceState(null, '', selected ? `#knihovna/${selected}` : '#knihovna');
    return render();
  }
  const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
  const id = selected;
  try {
    if (act === 'import') return openImport(null);
    if (act === 'select-shown') { multi = new Set(shown); selected = null; if (multi.size === 1) { selected = shown[0]; multi.clear(); } return render(); }
    if (act === 'clear-multi') { multi.clear(); return render(); }
    if (act === 'bulk-delete') {
      const free = [...multi].filter(id => D().media[id] && !usage(id).length);
      if (!free.length || !confirm(`Smazat ${free.length} ${free.length === 1 ? 'soubor' : free.length < 5 ? 'soubory' : 'souborů'} z knihovny i s kopiemi originálů? Nejde to vrátit.`)) return;
      let done = 0;
      for (const fid of free) { status('saving', `Mažu ${++done}/${free.length}…`); await api('DELETE', `/api/media/${fid}`); multi.delete(fid); }
      await refresh();
      status('ok', `Smazáno: ${done}` + (multi.size ? ` · ${multi.size} se používá, zůstaly` : ''));
      return render();
    }
    if (act === 'shelves') return openShelves(selected);
    if (act === 'look' || act === 'light') { pop = pop === act ? null : act; return render(); }
    if (act === 'close-pop') { pop = null; return render(); }
    if (act === 'look-save') { status('saving', 'Přepočítávám look…'); await api('POST', `/api/media/${id}/look`, { look: $('#lk').value || null }); pop = null; await refresh(); status('ok'); }
    if (act === 'light-save') { await api('PATCH', `/api/media/${id}`, { light: { x: $('#lx').value.replace(',', '.'), y: $('#ly').value.replace(',', '.'), radius: $('#lr').value } }); pop = null; await refresh(); status('ok', 'Světlo uloženo'); }
    if (act === 'light-off') { await api('PATCH', `/api/media/${id}`, { light: null }); pop = null; await refresh(); status('ok'); }
    if (act === 'delete') {
      if (!confirm(`Smazat „${D().media[id].name}“ z knihovny i s kopií originálu?`)) return;
      await api('DELETE', `/api/media/${id}`); selected = null; await refresh(); status('ok', 'Smazáno');
    }
  } catch (err) { status('err', err.message); }
}
async function onChange(e) {
  if (!e.target.matches('[data-replace]')) return;
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { status('saving', 'Nahrazuji soubor…'); await api('POST', `/api/media/${selected}/replace?name=${encodeURIComponent(f.name)}`, undefined, f); await refresh(); status('ok', 'Soubor nahrazen'); }
  catch (err) { status('err', err.message); }
}

// ---------- the import sheet ----------
// Every file has its own kind and look: click a file to set it, „Použít na všechny“ copies them.
const SOUND = /\.(mp3|m4a|ogg|wav)$/i, IMG = /\.(jpe?g|png|webp|tiff?)$/i;
const CARDS = [
  ['item', 'Věc na stěnu', 'rám s obrazem, předmět', ['item']],
  ['gallery', 'Fotky do galerie', 'k exponátu…', ['gallery']],
  ['wall', 'Tapeta / špína', 'dlaždice, skvrny', ['tile', 'grime']],
  ['room', 'Skříň / dveře', 'korpus, čela, samet, dveře', ['cabinet', 'drawer', 'tray', 'doors']],
  ['plate', 'Cedulka', 'jmenovka, štítek pod exponátem', ['plate']],
  ['surround', 'Obložení', 'bok, římsa, lambrie kolem místnosti', ['surround']],
];
const SHORT = { item: 'stěna', gallery: 'galerie', tile: 'tapeta', grime: 'špína', cabinet: 'korpus', drawer: 'čelo', tray: 'samet', doors: 'dveře', plate: 'cedulka', surround: 'obložení', sound: 'zvuk' };
const cardOf = kind => CARDS.find(c => c[3].includes(kind))?.[0];
let imp = null;   // { files: [{ file, url, kind, look, exhibit, small, previews }], cur, place, cut }

/** Opens the import sheet with `files` (or a file chooser first). opts: { kind, place, exhibit } */
export async function openImport(files, opts = {}) {
  if (!files) {
    const inp = Object.assign(document.createElement('input'), { type: 'file', multiple: true, accept: '.jpg,.jpeg,.png,.webp,.tif,.tiff,.mp3,.m4a,.ogg,.wav' });
    inp.onchange = () => inp.files.length && openImport([...inp.files], opts);
    inp.click();
    return;
  }
  files = files.filter(f => IMG.test(f.name) || SOUND.test(f.name));
  if (!files.length) return status('err', 'Tohle neumím importovat: jen obrázky (.jpg .png .webp .tif) a zvuky (.mp3 .m4a .ogg .wav)');
  imp = {
    files: files.map(file => ({ file, url: IMG.test(file.name) ? URL.createObjectURL(file) : null,
      kind: SOUND.test(file.name) ? 'sound' : opts.kind || 'item', look: '', exhibit: opts.exhibit || null, small: null, previews: {} })),
    cur: 0, place: opts.place ?? true, cut: 50,
  };
  drawSheet();
  select(0);
}
const curF = () => imp.files[imp.cur];
// a small copy made in the browser: looks are previewed on it, not on a 40 MB original
async function shrink(file, max) {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * s), height: Math.round(bmp.height * s) });
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/png'));
  } catch { return null; }   // a TIFF the browser cannot decode: no preview, the import still works
}
async function select(i) {
  imp.cur = i; drawSheet();
  const f = curF();
  if (!f.url || f.small !== null) return;
  f.small = await shrink(f.file, 640) || false;
  if (!imp || !f.small) { if (imp) drawSheet(); return; }
  f.previews[''] = URL.createObjectURL(f.small);
  if (imp.files[imp.cur] === f) { drawLooks(); drawSplit(); }
  for (const l of store.S.looks.map(x => x.id)) {
    try {
      const res = await fetch('/api/look-preview?look=' + encodeURIComponent(l), { method: 'POST', body: f.small });
      if (res.ok) f.previews[l] = URL.createObjectURL(await res.blob());
    } catch {}
    if (!imp) return;
    if (imp.files[imp.cur] === f) { drawLooks(); if (l === f.look) drawSplit(); }
  }
}
function sheetEl() {
  let el = $('#import-sheet');
  if (!el) {
    el = document.createElement('aside'); el.id = 'import-sheet'; el.className = 'sheet'; el.setAttribute('aria-label', 'Import');
    el.addEventListener('click', onSheetClick); el.addEventListener('change', onSheetChange);
    stopPointer(el);
    document.body.appendChild(el);
  }
  return el;
}
function drawSheet() {
  const el = sheetEl(), n = imp.files.length, f = curF(), isSound = f.kind === 'sound', card = cardOf(f.kind);
  const lookShort = l => !l ? '' : ' · ' + (store.S.looks.find(x => x.id === l)?.name || l.replace(/^lut:/, ''));
  const exhibits = D().items.filter(i => i.exhibit).sort((a, b) => a.exhibit.inv - b.exhibit.inv);
  const sub = card === 'wall' ? [['tile', 'Tapeta (bezešvá dlaždice)'], ['grime', 'Špína přes stěnu']]
    : card === 'room' ? [['cabinet', 'Korpus skříně'], ['drawer', 'Čelo šuplíku'], ['tray', 'Samet'], ['doors', 'Dveře (úvodní stránka)']] : null;
  const anyItem = imp.files.some(x => x.kind === 'item');
  el.innerHTML = `<div class="sh-head"><h2>Import · ${n} ${n === 1 ? 'soubor' : n < 5 ? 'soubory' : 'souborů'}</h2><button class="icon-btn" data-act="close" aria-label="Zavřít import">×</button></div>
    <div class="sh-body">
      <div class="stack"><span class="label">${n > 1 ? 'Soubory · klikni na soubor a nastav ho' : 'Soubor'}</span>
        <div class="files">${imp.files.map((x, i) => `<button class="f checker ck${i === imp.cur ? ' first' : ''}" data-file="${i}" title="${esc(x.file.name)}" aria-pressed="${i === imp.cur}">
          ${x.url ? `<img src="${x.url}" alt="">` : '<span class="snd" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px">♪</span>'}
          <span class="fk">${SHORT[x.kind]}${x.look ? ' ✦' : ''}</span></button>`).join('')}</div>
        <div class="row" style="justify-content:space-between"><span class="hint" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px">${esc(f.file.name)} – ${SHORT[f.kind]}${lookShort(f.look)}</span>
          ${n > 1 && !isSound ? '<button class="btn sm" data-act="all">Použít na všechny</button>' : ''}</div></div>
      ${isSound ? '<p class="hint">Zvuky se publikují tak, jak jsou (nejlíp .mp3). Vrznutí přiřadíš v Místnost → Úvodní dveře.</p>' : `
      <div class="stack"><span class="label">Co to je</span>
        <div class="kinds">${CARDS.map(([k, b, s]) => `<button data-card="${k}" aria-pressed="${card === k}"><b>${b}</b><span>${s}</span></button>`).join('')}</div>
        ${card === 'gallery' ? `<select class="field" data-exhibit><option value="">— jen do knihovny —</option>${exhibits.map(d => `<option value="${esc(d.exhibit.slug)}"${f.exhibit === d.exhibit.slug ? ' selected' : ''}>${esc(d.exhibit.title)} (${String(d.exhibit.inv).padStart(3, '0')})</option>`).join('')}</select>` : ''}
        ${sub ? `<div class="seg">${sub.map(([k, l]) => `<button data-sub="${k}" aria-pressed="${f.kind === k}">${l}</button>`).join('')}</div>` : ''}
      </div>
      <div class="stack"><span class="label">Look</span><div class="looks" id="imp-looks"></div></div>
      <div class="stack"><span class="label">Před · po</span><div class="split" id="imp-split"></div></div>`}
    </div>
    <div class="sh-foot">
      ${anyItem ? `<label class="check" style="flex:1"><input type="checkbox" data-place${imp.place ? ' checked' : ''}> Věci na stěnu po importu pověsit</label>` : '<span style="flex:1"></span>'}
      <button class="btn primary" data-act="go">Importovat ${n}</button>
    </div>`;
  drawLooks(); drawSplit();
}
function drawLooks() {
  const box = $('#imp-looks'); if (!box || !imp) return;
  const f = curF(), looks = [['', 'Žádný'], ...store.S.looks.map(l => [l.id, l.name])];
  box.innerHTML = looks.map(([id, name]) => `<button data-look="${esc(id)}" aria-pressed="${f.look === id}"><span class="lp" style="${f.previews[id] ? `background-image:url('${f.previews[id]}')` : ''}"></span><span class="ln">${esc(name)}</span></button>`).join('');
}
function drawSplit() {
  const box = $('#imp-split'); if (!box || !imp) return;
  const f = curF();
  if (f.small === false) { box.innerHTML = '<p class="hint" style="padding:12px">Náhled tohoto formátu prohlížeč neumí, import ale proběhne.</p>'; return; }
  box.style.setProperty('--cut', imp.cut + '%');
  box.innerHTML = `<img src="${f.previews[''] || ''}" alt="Před"><img class="after" src="${f.previews[f.look] || f.previews[''] || ''}" alt="Po"><span class="bar"></span><span class="knob"></span>
    <span class="tagl">před</span><span class="tagr">${esc(f.look ? store.S.looks.find(l => l.id === f.look)?.name || f.look : 'Žádný')}</span>`;
  box.onpointerdown = e => {
    const set = ev => { const r = box.getBoundingClientRect(); imp.cut = Math.max(0, Math.min(100, (ev.clientX - r.left) / r.width * 100)); box.style.setProperty('--cut', imp.cut + '%'); };
    set(e);
    const up = () => { removeEventListener('pointermove', set); removeEventListener('pointerup', up); };
    addEventListener('pointermove', set); addEventListener('pointerup', up);
  };
}
function closeSheet() { $('#import-sheet')?.remove(); imp = null; }
function onSheetClick(e) {
  const t = e.target, f = imp && curF();
  if (t.closest('[data-act="close"]')) return closeSheet();
  const fb = t.closest('[data-file]'); if (fb) return select(Number(fb.dataset.file));
  const c = t.closest('[data-card]'); if (c) { f.kind = CARDS.find(x => x[0] === c.dataset.card)[3][0]; return drawSheet(); }
  const s = t.closest('[data-sub]'); if (s) { f.kind = s.dataset.sub; return drawSheet(); }
  const l = t.closest('[data-look]'); if (l) { f.look = l.dataset.look; return drawSheet(); }
  if (t.closest('[data-act="all"]')) {
    for (const x of imp.files) if (x.kind !== 'sound') Object.assign(x, { kind: f.kind, look: f.look, exhibit: f.exhibit });
    status('info', 'Druh a look použity na všechny obrázky');
    return drawSheet();
  }
  if (t.closest('[data-act="go"]')) return runImport();
}
function onSheetChange(e) {
  if (e.target.matches('[data-place]')) imp.place = e.target.checked;
  if (e.target.matches('[data-exhibit]')) curF().exhibit = e.target.value || null;
}
async function runImport() {
  const job = imp; closeSheet();
  const done = [];   // [{ id, kind, exhibit }]
  for (const [i, f] of job.files.entries()) {
    status('saving', `Importuji ${i + 1}/${job.files.length}: ${f.file.name}…`);
    try {
      const r = f.kind === 'sound'
        ? await api('POST', `/api/sound?name=${encodeURIComponent(f.file.name)}`, undefined, f.file)
        : await api('POST', `/api/media?name=${encodeURIComponent(f.file.name)}&kind=${f.kind}&look=${encodeURIComponent(f.look)}`, undefined, f.file);
      done.push({ id: r.id, kind: f.kind, exhibit: f.exhibit });
      if (r.warning) status('info', `${f.file.name}: ${r.warning}`);
    } catch (err) { status('err', `${f.file.name}: ${err.message}`); }
  }
  await refresh();
  if (!done.length) return;
  // gallery photos into their exhibits
  const toGallery = done.filter(d => d.kind === 'gallery' && d.exhibit);
  for (const slug of new Set(toGallery.map(d => d.exhibit))) {
    const it = D().items.find(x => x.exhibit?.slug === slug); if (!it) continue;
    const ids = toGallery.filter(d => d.exhibit === slug).map(d => d.id);
    commit('ex:gallery', () => { it.exhibit.gallery = [...it.exhibit.gallery, ...ids.filter(id => !it.exhibit.gallery.includes(id))]; }, { undoable: false });
  }
  const hang = job.place ? done.filter(d => d.kind === 'item').map(d => d.id) : [];
  if (hang.length) {
    location.hash = '#stena';
    setTimeout(() => { placeOnWall(hang); status('ok', `Importováno ${done.length}, na stěnu pověšeno ${hang.length}`); }, 50);
  } else if (toGallery.length && new Set(toGallery.map(d => d.exhibit)).size === 1 && toGallery.length === done.length) {
    status('ok', `Přidáno do galerie: ${toGallery.length}`);
    location.hash = `#exponaty/${encodeURIComponent(toGallery[0].exhibit)}`;
  } else {
    status('ok', `Importováno: ${done.length}`);
    if (!location.hash.startsWith('#knihovna')) location.hash = '#knihovna'; else render();
  }
}

// ---------- section life cycle ----------
export function init() {
  root().addEventListener('click', onClick);
  root().addEventListener('change', onChange);
  root().addEventListener('input', e => { if (e.target.id === 'lib-q') { q = e.target.value; const pos = e.target.selectionStart; render(); const i = $('#lib-q'); i.focus(); i.setSelectionRange(pos, pos); } });
  on('data', () => { if (!root().hidden) render(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && $('#import-sheet')) { e.stopImmediatePropagation(); closeSheet(); } }, true);
}
export function show(arg) {
  if (arg && D().media[arg]) { selected = arg; pop = null; }
  render();
  if (selected) $(`figure[data-id="${selected}"]`, root())?.scrollIntoView({ block: 'nearest' });
}
