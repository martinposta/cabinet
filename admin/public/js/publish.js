// The Publikovat dialog: what would change, what stands in the way, then commit + push (admin/git.mjs).
// Opens on the button; nothing is sent until the confirm button. Without an origin it only explains.

import { $, api, esc, flush, stopPointer } from './core.js';

const list = items => items.length ? `<ul>${items.join('')}</ul>` : '';
const li = t => `<li>${t}</li>`;

function changesHtml(c) {
  if (c.first) {
    const n = c.exhibits.added.length;
    return `<p>První publikování: celý web půjde ven najednou (${n} ${n === 1 ? 'exponát' : n < 5 ? 'exponáty' : 'exponátů'}, ${c.media.added} obrázků v knihovně). Podrobný seznam změn se ukáže od příštího publikování.</p>`;
  }
  const parts = [];
  const names = (a, verb) => a.length && li(`${verb}: ${a.map(x => `<b>${esc(x.label)}</b>`).join(', ')}`);
  parts.push(names(c.exhibits.added, 'Nové exponáty'), names(c.exhibits.removed, 'Odebrané exponáty'));
  for (const e of c.exhibits.edited) {
    parts.push(li(`<b>${esc(e.label)}</b>: ${e.fields.map(f => f.from === undefined ? esc(f.label) : `${esc(f.label)}${f.label === 'Popis' ? '' : ` (${esc(f.from || '—')} → ${esc(f.to || '—')})`}`).join(', ')}`));
  }
  const t = c.things;
  if (t.added || t.removed || t.moved) parts.push(li(`Stěna: ${[t.added && `${t.added} nových věcí`, t.removed && `${t.removed} odebraných`, t.moved && `${t.moved} přesunutých nebo upravených`].filter(Boolean).join(', ')}`));
  const m = c.media;
  if (m.added || m.removed || m.replaced) parts.push(li(`Knihovna: ${[m.added && `${m.added} nových obrázků`, m.removed && `${m.removed} odebraných`, m.replaced && `${m.replaced} nahrazených`].filter(Boolean).join(', ')}`));
  for (const s of c.settings) parts.push(li(s.from === undefined ? `Nastavení: ${esc(s.label)}` : `Nastavení – ${esc(s.label)}: ${esc(s.from || '—')} → ${esc(s.to || '—')}`));
  if (c.rooms.length) parts.push(li(`Místnost: ${c.rooms.map(esc).join(', ')}`));
  const n = c.notices || {};
  if (n.added || n.removed || n.edited) parts.push(li(`Aktuality: ${[n.added && `${n.added} nových zápisů`, n.edited && `${n.edited} upravených`, n.removed && `${n.removed} smazaných`].filter(Boolean).join(', ')}`));
  const out = parts.filter(Boolean);
  return out.length ? `<ul class="pub-list">${out.join('')}</ul>` : '<p class="hint">Na obsahu webu se oproti GitHubu nic nemění.</p>';
}

export async function openPublish() {
  await flush();
  const dlg = document.createElement('div');
  dlg.className = 'modal';
  dlg.innerHTML = `<div class="modal-box wide pub" role="dialog" aria-modal="true" aria-label="Publikovat">
    <div class="modal-head"><h2>Publikovat web</h2><button class="icon-btn" data-x aria-label="Zavřít">×</button></div>
    <div class="pub-body"><p class="hint">Zjišťuji stav…</p></div></div>`;
  const close = () => { dlg.remove(); removeEventListener('keydown', key, true); };
  const key = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } };
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-x]')) close(); });
  stopPointer(dlg);
  document.body.appendChild(dlg);
  addEventListener('keydown', key, true);
  const body = $('.pub-body', dlg);

  let git, changes, pf;
  try {
    git = await api('GET', '/api/git');
    if (git.remote) await api('POST', '/api/sync/check').then(g => (git = g)).catch(() => {});
    [changes, pf] = await Promise.all([api('GET', '/api/changes'), api('GET', '/api/preflight')]);
  } catch (err) { body.innerHTML = `<p class="warn">${esc(err.message)}</p>`; return; }

  const blockers = pf.audit.filter(f => f.level === 'error');
  const cErrors = pf.content.filter(f => f.level === 'error');
  const warns = [...pf.audit, ...pf.content].filter(f => f.level === 'warn');
  const msgs = a => list(a.map(f => li(esc(f.msg))));
  const noRemote = !git.repo || !git.remote;

  body.innerHTML = `
    ${noRemote ? `<div class="pub-box"><b>Zatím není kam publikovat.</b> Repozitář nemá GitHub (origin). Do té doby je všechno jen u tebe na Macu (D7). Až řekneš, založíme veřejný repozitář a tlačítko začne odesílat.</div>` : ''}
    ${git.behind ? `<div class="pub-box">Na GitHubu je ${git.behind} novějších změn, publikování je nejdřív spojí s tvými.</div>` : ''}
    <h3>Co se změní na webu</h3>${changesHtml(changes)}
    ${blockers.length ? `<h3 class="danger">Zastavuje publikování</h3>${msgs(blockers)}<p class="hint">To se nedá obejít, jde o to, co by se dostalo do veřejného repozitáře.</p>` : ''}
    ${cErrors.length ? `<h3 class="warn">Chyby v obsahu</h3>${msgs(cErrors)}<label class="pub-ack"><input type="checkbox" id="pub-ack"> Vím o nich, publikovat i tak</label>` : ''}
    ${warns.length ? `<details><summary>${warns.length} upozornění (nezastavují)</summary>${msgs(warns)}</details>` : ''}
    <label class="label" for="pub-msg">Popis změny (nepovinný)</label>
    <input id="pub-msg" class="pub-msg" type="text" placeholder="např. Nové fotky u exponátu Lars">
    <div class="row pub-actions"><button class="btn primary" id="pub-go">Publikovat</button><button class="btn" data-x>Zavřít</button></div>
    <pre class="pub-log" hidden></pre>`;
  const go = $('#pub-go', dlg), ack = $('#pub-ack', dlg), log = $('.pub-log', dlg);
  const sync = () => { go.disabled = noRemote || blockers.length > 0 || (cErrors.length > 0 && !ack?.checked); };
  ack?.addEventListener('change', sync); sync();
  go.addEventListener('click', async () => {
    go.disabled = true; go.textContent = 'Publikuji…';
    try {
      const r = await api('POST', '/api/publish', { message: $('#pub-msg', dlg).value, acknowledge: !!ack?.checked });
      log.hidden = false; log.textContent = 'Hotovo.\n\n' + r.log;
      go.textContent = 'Publikováno';
    } catch (err) {
      log.hidden = false; log.textContent = err.message; go.textContent = 'Publikovat'; go.disabled = false;
    }
  });
}
