// Section · Aktuality (phase 8a): the notices board's timeline – dated entries in plain English text,
// newest first – and where the board itself is (on the wall / taken off). The board is an ordinary hung
// item marked `opens: "notices"` on Stěna; here it is only shown, taken off and hung back.
// Texts save themselves while typing (no undo, like the exhibit texts); a new entry, a deletion and a
// changed date reload the list (it is re-sorted by date).

import { $, $$, esc, store, on, api, status, refresh, commit, stopPointer } from './core.js';

const root = () => $('#sec-aktuality');
const D = () => store.D;
const today = () => new Date().toLocaleDateString('sv');   // YYYY-MM-DD in local time
const board = () => D().items.find(i => i.opens === 'notices');
// newest first; the same date – the later written (later in the array) first, as on the site
const sorted = () => (D().notices || []).map((n, i) => ({ n, i })).sort((a, b) => b.n.date.localeCompare(a.n.date) || b.i - a.i).map(x => x.n);
let confirmDel = null, focusId = null;
const timers = new Map();

function boardCard() {
  const b = board();
  if (!b) return `<div class="card nb-state"><div><b>Tabule zatím není.</b>
    <span class="hint">Na Stěně vyber obrázek tabule a v Inspektoru → Exponát zaškrtni „Otevírá aktuality“.</span></div></div>`;
  if (b.off) return `<div class="card nb-state"><div><b>Tabule je mimo stěnu.</b>
    <span class="hint">Na webu se nezobrazuje – ani na stěně, ani vedle dveří. Zápisy zůstávají.</span></div>
    <button class="btn primary" data-act="hang">Pověsit zpět</button></div>`;
  return `<div class="card nb-state"><div><b>Tabule je na stěně.</b>
    <span class="hint">Návštěvník ji otevře kliknutím na stěně i vedle úvodních dveří.</span></div>
    <div class="row"><a class="btn" href="/#stena/${encodeURIComponent(b.id)}">Ukázat na stěně</a><button class="btn" data-act="off">Sundat ze stěny</button></div></div>`;
}

function render() {
  const list = sorted();
  root().innerHTML = `<main class="nt-main" aria-label="Aktuality"><div class="nt-col">
    <div class="row" style="justify-content:space-between"><h1>Aktuality</h1><button class="btn primary" data-act="new">+ Nový zápis</button></div>
    <p class="lead">Co je nového – na webu se to ukáže křídou na tabuli, od nejnovějšího. Píše se anglicky, nový řádek = nový odstavec.</p>
    ${boardCard()}
    ${list.map(n => `<div class="card nt-entry" data-id="${n.id}">
      <div class="row" style="justify-content:space-between"><input type="date" class="field nt-date" value="${esc(n.date)}" aria-label="Datum zápisu">
        ${confirmDel === n.id ? `<span class="row"><span class="warn">Opravdu smazat?</span><button class="btn sm danger" data-act="del-yes">Smazat</button><button class="btn sm" data-act="del-no">Ne</button></span>`
          : '<button class="btn sm" data-act="del">Smazat</button>'}</div>
      <textarea class="field nt-text" rows="3" placeholder="What is new…">${esc(n.text)}</textarea>
      ${n.text.trim() ? '' : '<span class="hint warn">Prázdný zápis se na web nedostane – publikování na něj upozorní.</span>'}
    </div>`).join('') || '<p class="hint">Zatím žádný zápis. Na tabuli se ukáže „Nothing new yet.“</p>'}
  </div></main>`;
  $$('.nt-text', root()).forEach(grow);
  if (focusId) { const t = $(`.nt-entry[data-id="${focusId}"] .nt-text`, root()); focusId = null; t?.focus(); }
}
const grow = t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; };

async function saveText(id, text) {
  try { status('saving'); await api('PATCH', `/api/notices/${id}`, { text }); status('ok'); }
  catch (err) { status('err', err.message); }
}

async function onClick(e) {
  const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
  const id = e.target.closest('.nt-entry')?.dataset.id;
  try {
    if (act === 'new') {
      status('saving');
      const r = await api('POST', '/api/notices', { date: today(), text: '' });
      focusId = r.notice.id; await refresh(); status('ok', 'Nový zápis');
    }
    if (act === 'del') { confirmDel = id; return render(); }
    if (act === 'del-no') { confirmDel = null; return render(); }
    if (act === 'del-yes') { confirmDel = null; status('saving'); await api('DELETE', `/api/notices/${id}`); await refresh(); status('ok', 'Zápis smazán'); }
    // the board off the wall and back: the same stored-off mechanism as for exhibits (it keeps its place)
    if (act === 'off') { commit('board-off', Dd => { const b = Dd.items.find(i => i.opens === 'notices'); if (b) { b.off = true; delete b.sits; } }); render(); status('ok', 'Tabule je mimo stěnu'); }
    if (act === 'hang') { commit('board-hang', Dd => { const b = Dd.items.find(i => i.opens === 'notices'); if (b) delete b.off; }); render(); status('ok', 'Tabule visí zpátky na svém místě'); }
  } catch (err) { status('err', err.message); }
}
function onInput(e) {
  const t = e.target; if (!t.matches('.nt-text')) return;
  grow(t);
  const id = t.closest('.nt-entry').dataset.id, n = (D().notices || []).find(x => x.id === id);
  if (n) n.text = t.value;     // keep the working copy current without re-rendering (focus stays)
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => { timers.delete(id); saveText(id, t.value); }, 700));
}
async function onChange(e) {
  const t = e.target;
  if (t.matches('.nt-text')) { const id = t.closest('.nt-entry').dataset.id; clearTimeout(timers.get(id)); timers.delete(id); await saveText(id, t.value); return; }   // no re-render: the click that blurred it may be into the next field
  if (t.matches('.nt-date')) {
    const id = t.closest('.nt-entry').dataset.id;
    try { status('saving'); await api('PATCH', `/api/notices/${id}`, { date: t.value }); await refresh(); status('ok'); }
    catch (err) { status('err', err.message); render(); }
  }
}

export function init() {
  root().addEventListener('click', onClick);
  root().addEventListener('input', onInput);
  root().addEventListener('change', onChange);
  on('data', () => { if (!root().hidden && !root().contains(document.activeElement)) render(); });
  on('layout', () => { if (!root().hidden) render(); });
  stopPointer(root());
}
export function show() { render(); }
export async function hide() {
  // anything still waiting to be saved goes out now
  for (const [id, t] of timers) { clearTimeout(t); const n = (D().notices || []).find(x => x.id === id); if (n) await saveText(id, n.text); }
  timers.clear();
}
