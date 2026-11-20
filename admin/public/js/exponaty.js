// Section 2 · Exponáty (phase 3b): the content of every exhibit in one document-style editor – texts,
// tags, gallery, share preview. Everything else about an item (where it is, its image) stays on Stěna.
// Text edits save themselves (debounce/blur) and are not part of the wall's undo history.

import { $, $$, esc, store, on, commit, api, status, item, where, mediaSrc, itemName, inv, uniqueSlug, nextInv,
  missing, pickMedia, stopPointer, usage, refresh } from './core.js';

const root = () => $('#sec-exponaty');
let current = null;            // slug of the open exhibit
let filter = 'all';
const D = () => store.D;
const exhibits = () => D().items.filter(i => i.exhibit).sort((a, b) => a.exhibit.inv - b.exhibit.inv);
const bySlug = s => D().items.find(i => i.exhibit?.slug === s);
const coverOf = d => (d.exhibit.gallery || []).find(g => D().media[g]) || d.media;
const placeTxt = d => d.off ? 'Mimo stěnu' : ({ wall: 'Na stěně', cabinet: 'Na skříni', drawer: `Šuplík ${d.drawer + 1}` }[where(d)]);
const FILTERS = {
  all: ['Vše', () => true],
  nophoto: ['Bez fotek', d => !(d.exhibit.gallery || []).some(g => D().media[g])],
  nodesc: ['Bez popisu', d => !d.exhibit.description],
  drawer: ['V šuplících', d => d.drawer != null && !d.off],
  // sundané ze stěny: na webu nejsou, texty a galerie zůstaly
  off: ['Mimo stěnu', d => !!d.off],
};

// ---------- the list ----------
function renderList() {
  const all = exhibits(), list = all.filter(FILTERS[filter][1]);
  const chips = Object.entries(FILTERS).map(([k, [label, f]]) => {
    const n = all.filter(f).length, amber = k === 'nodesc' && n;
    return `<button class="chip${amber ? ' amber' : ''}" data-f="${k}" aria-pressed="${filter === k}">${label} ${n}</button>`;
  }).join('');
  const rows = list.map(d => {
    const ex = d.exhibit, miss = missing(ex);
    const sub = miss.length ? `<span class="warn">${esc(miss[0])}</span>` : esc((where(d) !== 'wall' || d.off ? placeTxt(d) + ' · ' : '') + (ex.medium || ''));
    return `<button class="ex-row${ex.slug === current ? ' on' : ''}${d.off ? ' off' : ''}" data-s="${esc(ex.slug)}">
      <span class="thumb checker" style="background-image:url('${mediaSrc(coverOf(d))}')"></span>
      <span class="tx"><span class="t1">${esc(ex.title || itemName(d))}</span><span class="t2">${sub}</span></span>
      <span class="invn">${inv(ex.inv)}</span></button>`;
  }).join('') || '<p class="hint" style="padding:8px">Nic takového tu není.</p>';
  $('.ex-list', root()).innerHTML = `<div class="hd2">
      <div class="row" style="justify-content:space-between"><h1>Exponáty</h1><button class="btn" data-act="make">+ Udělat exponát z věci…</button></div>
      <div class="row">${chips}</div></div>
    <div class="ex-rows">${rows}</div>`;
}

// ---------- the exhibit's own picture (the one on the wall) ----------
// The two ways it already changes elsewhere, here next to the texts: „Zaměnit“ = another library image for
// this exhibit (Stěna's swap: the width on the wall stays, the height follows the new proportions, the frame
// opening is dropped – it belonged to the old picture); „Nahradit soubor“ = a new version of the same image
// (Knihovna's replace: same id, so it changes everywhere it is used).
function mainImageBlock(d) {
  const m = d.media && D().media[d.media], uses = d.media ? usage(d.media).length : 0;
  return `<div class="stack" style="gap:10px">
    <h2 style="margin:0;font-size:15px;font-weight:600">Obrázek na stěně</h2>
    <div class="media-pick"><span class="thumb checker ck">${m ? `<img src="${mediaSrc(d.media)}" alt="">` : ''}</span>
      <span class="tx"><b>${m ? esc(m.name) : 'zástupný obrázek'}</b><span class="hint">${m ? `${m.w} × ${m.h} px · na stěně ${Math.round(d.w || 0)} px široký${uses > 1 ? ` · použitý ${uses}×` : ''}` : 'malovaný – vyber skutečný obrázek'}</span></span>
      <button class="btn" data-act="swap-img">Zaměnit za jiný z knihovny…</button>
      ${m ? '<label class="btn">Nahradit soubor…<input type="file" accept=".jpg,.jpeg,.png,.webp,.tif,.tiff" data-replace-main hidden></label>' : ''}</div>
    <p class="hint">Zaměnit = jiný obrázek z Knihovny pro tenhle exponát (šířka na stěně zůstane, výška se přizpůsobí). Nahradit soubor = nová verze téhož obrázku – změní se všude, kde je použitý. Bez fotek v galerii ukazuje web tenhle obrázek i v detailu.</p>
  </div>`;
}
async function swapImage() {
  const d = bySlug(current); if (!d) return;
  const id = await pickMedia({ title: 'Zaměnit obrázek exponátu', kinds: ['item'], current: d.media });
  if (!id || id === d.media) return;
  commit('swap', () => {
    if (!d.media) { d.w = d.placeholder?.w || 300; delete d.placeholder; }
    d.media = id; delete d.opening;
  });
  status('ok', 'Obrázek zaměněn'); renderList(); renderDoc();
}
async function replaceImage(f) {
  const d = bySlug(current); if (!d?.media || !f) return;
  const uses = usage(d.media).length;
  if (uses > 1 && !confirm(`Tenhle obrázek je použitý ${uses}× (${usage(d.media).map(u => u[0]).join(', ')}). Nový soubor se ukáže všude. Pokračovat?`)) return;
  try {
    status('saving', 'Nahrazuji soubor…');
    const r = await api('POST', `/api/media/${d.media}/replace?name=${encodeURIComponent(f.name)}`, undefined, f);
    await refresh(); status('ok', r.warning || 'Soubor nahrazen');
  } catch (err) { status('err', err.message); }
}

// ---------- the document ----------
function renderDoc() {
  const doc = $('.ex-doc', root());
  const d = current && bySlug(current);
  if (!d) {
    doc.innerHTML = `<div class="inner"><p class="hint">${exhibits().length ? 'Vyber exponát vlevo.' : 'Zatím žádný exponát. Udělej ho z věci na stěně tlačítkem vlevo nahoře.'}</p></div>`;
    return;
  }
  const ex = d.exhibit, site = D().settings.siteUrl || '';
  const host = site.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'cabinet.martinposta.com';
  doc.innerHTML = `<div class="inner">
    <div class="row" style="gap:12px">
      <label class="inv-in" title="Inventární číslo – na štítku pod exponátem, v detailu a pořadí na telefonu">inv. č.<input data-k="inv" value="${inv(ex.inv)}" inputmode="numeric" maxlength="4" spellcheck="false" aria-label="Inventární číslo"></label>
      <span class="hint" style="font-size:13px">${placeTxt(d)}</span>
      <span style="flex:1"></span>
      ${d.off ? '' : `<a class="btn" href="/#stena/${encodeURIComponent(d.id)}">Ukázat na stěně</a>
      <a class="btn" href="/preview/e/${encodeURIComponent(ex.slug)}/" target="kabinet-preview">Otevřít detail na webu ↗</a>`}
    </div>
    ${d.off ? `<div class="stored-note"><div><b>Tento exponát je mimo stěnu.</b>
        <span class="hint">Na webu se neukazuje, texty i galerie zůstávají tady. Inventární číslo a adresa mu zůstávají rezervované.</span></div>
      <div class="row"><button class="btn primary" data-act="rehang">Pověsit zpět na stěnu</button><button class="btn danger" data-act="purge">Smazat natrvalo</button></div></div>` : ''}
    <div class="stack" style="gap:14px">
      <label class="fld"><span>Název</span><input class="title-in" data-k="title" value="${esc(ex.title)}" placeholder="Název exponátu"></label>
      <div class="grid2" style="gap:14px">
        <label class="fld"><span>Technika / obor</span><input class="field" style="padding:10px 12px;font-size:14px" data-k="medium" value="${esc(ex.medium)}" placeholder="např. VR game · Unreal Engine 5"></label>
        <label class="fld"><span>Adresa</span><span class="slug-in">…/e/<input data-k="slug" value="${esc(ex.slug)}" spellcheck="false">/</span></label>
      </div>
      <label class="fld"><span class="row" style="justify-content:space-between"><span>Popis (anglicky)</span><span id="ex-count">${ex.description.length} znaků</span></span>
        <textarea class="field" rows="6" style="padding:12px 14px;font-size:15px;line-height:1.6" data-k="description" placeholder="Co to je, proč to vzniklo, co je na tom zajímavé.">${esc(ex.description)}</textarea></label>
      <div class="fld"><span>Štítky</span>
        <div class="tagbox">${(ex.tags || []).map((t, i) => `<span class="tg">${esc(t)} <button data-tag-del="${i}" aria-label="Odebrat ${esc(t)}">×</button></span>`).join('')}
          <input id="tag-in" placeholder="přidat štítek…" aria-label="Přidat štítek"></div></div>
      <label class="check"><input type="checkbox" data-k="plaque"${ex.plaque !== false ? ' checked' : ''}> Mosazný štítek s číslem pod věcí na stěně</label>
    </div>
    ${mainImageBlock(d)}
    <div class="stack" style="gap:12px">
      <div class="row" style="justify-content:space-between"><h2 style="margin:0;font-size:15px;font-weight:600">Galerie <span class="hint" style="font-size:13px;font-weight:400">· ${(ex.gallery || []).length} ${plural((ex.gallery || []).length)} · přetažením změníš pořadí, první je obálka</span></h2>
        <button class="btn" data-act="pick">Vybrat z knihovny</button></div>
      <div class="gal-grid">${(ex.gallery || []).filter(g => D().media[g]).map((g, i, all) => `<figure draggable="true" data-g="${g}">
          <div class="ph${i === 0 ? ' cover' : ''}" style="background-image:url('${mediaSrc(g)}')">${i === 0 ? '<span class="cv">OBÁLKA</span>' : ''}
            <span class="acts"><button data-mv="-1" aria-label="Posunout dopředu"${i === 0 ? ' disabled' : ''}>←</button><button data-mv="1" aria-label="Posunout dozadu"${i === all.length - 1 ? ' disabled' : ''}>→</button><button data-del aria-label="Odebrat z galerie">×</button></span></div>
          <input data-cap="${g}" placeholder="Popisek" aria-label="Popisek fotky ${i + 1}" value="${esc(ex.captions?.[g] || '')}">
        </figure>`).join('')}
        <label class="gal-drop"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>
          <span>Přetáhni fotky<br>nebo klikni</span><input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.tif,.tiff" hidden data-upload></label>
      </div>
      ${(ex.gallery || []).length ? '' : '<p class="hint">Bez fotek ukazuje web na detailu jen obrázek ze stěny.</p>'}
    </div>
    <div class="stack" style="gap:10px">
      <h2 style="margin:0;font-size:15px;font-weight:600">Takhle bude vypadat sdílený odkaz</h2>
      <div class="share"><span class="im" style="background-image:url('${mediaSrc(coverOf(d), 960)}')"></span>
        <span class="tx"><span class="hint" style="font-size:11px">${esc(host)}</span>
          <b>${esc(ex.title || itemName(d))} · ${esc(D().settings.plateTitle || 'Cabinet of Curiosities')}</b>
          <span style="color:var(--ink-mid);font-size:12px;line-height:1.5">${esc(trim(ex.description || ex.medium || D().settings.description || '', 140))}</span></span></div>
    </div>
  </div>`;
}
const plural = n => n === 1 ? 'fotka' : n >= 2 && n <= 4 ? 'fotky' : 'fotek';
const trim = (s, n) => s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s;

// ---------- saving ----------
let typingTimer = null, pending = null;
function save(label, fn, rerender = false) {
  const d = bySlug(current); if (!d) return;
  clearTimeout(typingTimer); pending = null;
  try { commit('ex:' + label, () => fn(d.exhibit, d), { undoable: false }); }
  catch (err) { status('err', err.message); }
  renderList();
  if (rerender) renderDoc();
}
function onInput(e) {
  const k = e.target.dataset.k;
  if (k === 'description') $('#ex-count').textContent = `${e.target.value.length} znaků`;
  // the number is not autosaved while typing: „1“ on the way to „17“ would ask to swap with 001
  if (!k || e.target.type === 'checkbox' || k === 'inv') return;
  clearTimeout(typingTimer);
  pending = e;
  typingTimer = setTimeout(() => { pending = null; onChange(e); }, 800);   // autosave while typing
}
function onChange(e) {
  const k = e.target.dataset.k, cap = e.target.dataset.cap;
  if (cap) return save('caption', ex => { const v = e.target.value.trim(); ex.captions = { ...(ex.captions || {}) }; if (v) ex.captions[cap] = v; else delete ex.captions[cap]; });
  if (e.target.matches('[data-upload]')) { const files = [...e.target.files]; e.target.value = ''; return upload(files); }
  if (e.target.matches('[data-replace-main]')) { const f = e.target.files[0]; e.target.value = ''; return replaceImage(f); }
  if (!k) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (k === 'inv') {
    // the number shows on the plaque and in the detail and orders the phone list; taken → offer a swap
    const n = Number(String(v).trim()), d = bySlug(current);
    if (!Number.isInteger(n) || n < 1 || n > 9999) { e.target.value = inv(d.exhibit.inv); return status('err', 'Inventární číslo: celé číslo 1–9999'); }
    if (n === d.exhibit.inv) { e.target.value = inv(n); return; }
    const other = D().items.find(i => i !== d && i.exhibit?.inv === n);
    if (other && !confirm(`Číslo ${inv(n)} už má „${other.exhibit.title || other.id}“. Prohodit čísla? (Ten pak dostane ${inv(d.exhibit.inv)}.)`)) { e.target.value = inv(d.exhibit.inv); return; }
    const old = d.exhibit.inv;
    // one commit, so the layout is never saved with two exhibits on one number (the server refuses that)
    commit('ex:inv', () => { if (other) other.exhibit.inv = old; d.exhibit.inv = n; }, { undoable: false });
    status('ok', other ? `Čísla prohozena: ${inv(n)} ↔ ${inv(old)}` : `Nové číslo ${inv(n)}`);
    renderList(); return renderDoc();
  }
  if (k === 'slug') {
    const s = String(v).trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) return status('err', 'Adresa: jen malá písmena, číslice a pomlčky');
    if (s !== current && bySlug(s)) return status('err', `Adresu „${s}“ už má jiný exponát`);
    save('slug', ex => { ex.slug = s; });
    current = s; history.replaceState(null, '', `#exponaty/${encodeURIComponent(s)}`);
    return renderList();
  }
  save(k, ex => { ex[k] = k === 'plaque' ? v : String(v).trim() === '' && k !== 'description' ? '' : v; });
}
function onKey(e) {
  if (e.target.id !== 'tag-in') return;
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const v = e.target.value.trim().replace(/,$/, ''); if (!v) return;
    save('tags', ex => { if (!(ex.tags || []).includes(v)) ex.tags = [...(ex.tags || []), v]; }, true);
    $('#tag-in')?.focus();
  } else if (e.key === 'Backspace' && !e.target.value) {
    save('tags', ex => { ex.tags = (ex.tags || []).slice(0, -1); }, true);
    $('#tag-in')?.focus();
  }
}
async function onClick(e) {
  const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; return renderList(); }
  const row = e.target.closest('[data-s]'); if (row) { location.hash = `#exponaty/${encodeURIComponent(row.dataset.s)}`; return; }
  const td = e.target.closest('[data-tag-del]'); if (td) return save('tags', ex => { ex.tags = ex.tags.filter((_, i) => i !== Number(td.dataset.tagDel)); }, true);
  const mv = e.target.closest('[data-mv]'); if (mv) { const g = mv.closest('[data-g]').dataset.g; return move(g, Number(mv.dataset.mv)); }
  const del = e.target.closest('[data-del]'); if (del) { const g = del.closest('[data-g]').dataset.g; return save('gallery', ex => { ex.gallery = ex.gallery.filter(x => x !== g); if (ex.captions) delete ex.captions[g]; }, true); }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'pick') {
    const d = bySlug(current);
    const id = await pickMedia({ title: 'Přidat fotku z knihovny', kinds: ['gallery'] });
    if (id) save('gallery', ex => { if (!ex.gallery.includes(id)) ex.gallery = [...ex.gallery, id]; }, true);
    void d;
  }
  if (act === 'make') makeExhibit();
  if (act === 'swap-img') swapImage();
  if (act === 'rehang') rehang();
  if (act === 'purge') purge();
}
/** Back to the spot it was taken from; into a drawer that no longer exists → onto the cabinet top. */
function rehang() {
  const d = bySlug(current); if (!d) return;
  commit('rehang', D => {
    const it = D.items.find(i => i.id === d.id); delete it.off;
    if (it.drawer != null && it.drawer >= (D.cabinet.drawers || []).length) {
      delete it.drawer; delete it.dx; delete it.dy; it.on = 'cabinet'; it.x = D.cabinet.x; it.y = D.cabinet.top - 60;
    }
  });
  status('ok', 'Pověšeno zpátky na stěnu');
  location.hash = `#stena/${encodeURIComponent(d.id)}`;
}
function purge() {
  const d = bySlug(current); if (!d) return;
  const n = (d.exhibit.gallery || []).length;
  if (!confirm(`Smazat „${d.exhibit.title || d.id}“ natrvalo? Zmizí název, popis, štítky a pořadí galerie${n ? ` (${n} fot.)` : ''}. Obrázky samotné zůstanou v Knihovně.`)) return;
  commit('purge', D => { D.items = D.items.filter(i => i.id !== d.id); });
  current = null;
  status('ok', 'Exponát smazán, obrázky jsou v Knihovně');
  location.hash = '#exponaty';
}
function move(g, by) {
  save('gallery', ex => {
    const list = [...ex.gallery], i = list.indexOf(g), j = i + by;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]]; ex.gallery = list;
  }, true);
}

// gallery: drag & drop to reorder (HTML5 – fine on a desktop admin)
let dragG = null;
function onDragStart(e) { const f = e.target.closest?.('figure[data-g]'); if (!f) return; dragG = f.dataset.g; f.classList.add('dragging'); e.dataTransfer.setData('text/kabinet-gal', dragG); e.dataTransfer.effectAllowed = 'move'; }
function onDragOver(e) {
  const files = [...e.dataTransfer.types].includes('Files');
  const zone = e.target.closest?.('.gal-drop'); $$('.gal-drop', root()).forEach(z => z.classList.toggle('over', !!zone && files));
  if (!dragG) return;
  const f = e.target.closest?.('figure[data-g]');
  $$('figure.over', root()).forEach(x => x !== f && x.classList.remove('over'));
  if (f && f.dataset.g !== dragG) { e.preventDefault(); f.classList.add('over'); }
}
function onDrop(e) {
  const zone = e.target.closest?.('.gal-drop');
  if (zone && e.dataTransfer.files.length) { e.preventDefault(); e.stopPropagation(); zone.classList.remove('over'); return upload([...e.dataTransfer.files]); }
  if (!dragG) return;
  e.preventDefault();
  const f = e.target.closest?.('figure[data-g]'), from = dragG; dragG = null;
  if (!f || f.dataset.g === from) return renderDoc();
  const to = f.dataset.g;
  save('gallery', ex => { const list = ex.gallery.filter(x => x !== from); list.splice(list.indexOf(to) + (ex.gallery.indexOf(from) < ex.gallery.indexOf(to) ? 1 : 0), 0, from); ex.gallery = list; }, true);
}
function onDragEnd() { dragG = null; $$('figure.dragging, figure.over', root()).forEach(f => f.classList.remove('dragging', 'over')); }

// ---------- uploads straight into the open gallery ----------
async function upload(files) {
  const d = bySlug(current); if (!d || !files.length) return;
  const ok = /\.(jpe?g|png|webp|tiff?)$/i;
  const added = [];
  for (const [i, f] of files.entries()) {
    if (!ok.test(f.name)) { status('err', `${f.name}: do galerie jen obrázky`); continue; }
    status('saving', `Nahrávám fotky ${i + 1}/${files.length}…`);
    try { const r = await api('POST', `/api/media?name=${encodeURIComponent(f.name)}&kind=gallery`, undefined, f); D().media[r.id] = r.media; added.push(r.id); }
    catch (err) { status('err', `${f.name}: ${err.message}`); }
  }
  if (added.length) save('gallery', ex => { ex.gallery = [...ex.gallery, ...added.filter(id => !ex.gallery.includes(id))]; }, true);
}
/** Files dropped anywhere in Exponáty go straight into the open exhibit's gallery. */
export function takeFiles(files) { if (!current || !bySlug(current)) return false; upload(files); return true; }

// ---------- make an exhibit out of a decoration ----------
function makeExhibit() {
  const decos = D().items.filter(i => !i.exhibit);
  const dlg = document.createElement('div');
  dlg.className = 'modal';
  dlg.innerHTML = `<div class="modal-box wide" role="dialog" aria-modal="true" aria-label="Udělat exponát z věci">
    <div class="modal-head"><h2>Udělat exponát z věci</h2><button class="icon-btn" data-x aria-label="Zavřít">×</button></div>
    <p class="hint">Vyber dekoraci. Dostane další volné číslo (${inv(nextInv())}) a otevře se tady k vyplnění.</p>
    <div class="pick-grid">${decos.map(d => `<button class="pick" data-id="${esc(d.id)}"><span class="checker thumb" style="background-image:url('${mediaSrc(d.media)}')"></span><span class="nm">${esc(itemName(d))} · ${placeTxt(d).toLowerCase()}</span></button>`).join('') || '<p class="hint">Všechno už je exponát.</p>'}</div>
  </div>`;
  dlg.addEventListener('click', e => {
    if (e.target === dlg || e.target.closest('[data-x]')) return dlg.remove();
    const b = e.target.closest('.pick'); if (!b) return;
    const d = item(b.dataset.id); dlg.remove();
    const slug = uniqueSlug(d.id);
    // an on/off decision like the inspector's switch on Stěna: this one is undoable there
    commit('exhibit', () => { d.exhibit = { slug, inv: nextInv(), title: itemName(d), medium: '', description: '', tags: [], gallery: [], plaque: true }; });
    location.hash = `#exponaty/${encodeURIComponent(slug)}`;
  });
  stopPointer(dlg);
  document.body.appendChild(dlg);
}

// ---------- section life cycle ----------
export function init() {
  root().innerHTML = '<section class="ex-list" aria-label="Seznam exponátů"></section><main class="ex-doc" aria-label="Obsah exponátu"></main>';
  root().addEventListener('click', onClick);
  root().addEventListener('input', onInput);
  root().addEventListener('change', onChange);
  root().addEventListener('keydown', onKey);
  root().addEventListener('dragstart', onDragStart);
  root().addEventListener('dragover', onDragOver);
  root().addEventListener('drop', onDrop);
  root().addEventListener('dragend', onDragEnd);
  on('data', () => { if (!root().hidden) { renderList(); renderDoc(); } });
}
export function show(arg) {
  const list = exhibits();
  current = arg && bySlug(arg) ? arg : (current && bySlug(current) ? current : list[0]?.exhibit.slug || null);
  const h = current ? `#exponaty/${encodeURIComponent(current)}` : '#exponaty';
  if (location.hash !== h) history.replaceState(null, '', h);
  renderList(); renderDoc();
}
// leaving mid-sentence: what was typed is saved, not dropped
export function hide() { clearTimeout(typingTimer); if (pending) { const e = pending; pending = null; onChange(e); } }
