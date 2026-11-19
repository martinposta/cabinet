// Section 4 · Místnost (phase 3b; replaces the tabs „Stěna a skříň“ + „Nastavení“): the room around the
// exhibits (wallpaper, cabinet and its drawers drawn on the photo, doors, nameplate) and the web settings.

import { $, $$, esc, r2, store, on, api, status, refresh, commit, flush, mediaSrc, itemName, pickMedia, stopPointer } from './core.js';
import { makeNameplate, plateLook } from '/preview/js/wall.js';
import { rectDialog } from './shelves.js';

const root = () => $('#sec-mistnost');
const D = () => store.D;
const PARTS = [
  ['Místnost', [['tapeta', 'Tapeta a špína'], ['skrin', 'Skříň a šuplíky'], ['dvere', 'Úvodní dveře'], ['jmenovka', 'Jmenovka a štítky'], ['oblozeni', 'Obložení místnosti']]],
  ['Web', [['adresa', 'Adresa a popis'], ['efekty', 'Světlo a efekty'], ['statistika', 'Statistika']]],
];
let part = 'skrin';
const SU_ROLES = ['sideTop', 'sideMid', 'cornice', 'wainscot'];

function frame(main) {
  root().innerHTML = `<nav class="subnav" aria-label="Části místnosti">${PARTS.map(([g, list], i) =>
    `<span class="label${i ? ' gap' : ''}">${g}</span>` + list.map(([k, l]) => `<a href="/#mistnost/${k}"${k === part ? ' aria-current="page"' : ''}>${l}</a>`).join('')).join('')}</nav>
    <main class="room-main">${main}</main>`;
}
const mediaCard = (role, title, id, empty = 'není vybraný') => {
  const m = id && D().media[id];
  return `<div class="media-pick"><span class="thumb checker ck">${m ? `<img src="${mediaSrc(id)}" alt="">` : ''}</span>
    <span class="tx"><b>${title}</b><span class="hint">${m ? esc(m.name) : empty}</span></span>
    <button class="btn" data-pick="${role}">Změnit…</button>${m ? `<button class="btn" data-clear="${role}">Zrušit</button>` : ''}</div>`;
};
const field = (k, label, v, attrs = '') => `<label class="fld"><span>${label}</span><input class="field" data-s="${k}" value="${esc(v ?? '')}" ${attrs}></label>`;

// ---------- the parts ----------
function render() {
  const S = D().settings, W = D().wall, dr = D().doors || {};
  if (part === 'tapeta') return frame(`<h1>Tapeta a špína</h1>
    <p class="lead">Tapeta je bezešvá dlaždice opakovaná přes celou stěnu, špína jeden velký obrázek s průhledností přes ni.</p>
    <div class="form">${mediaCard('wallpaper', 'Tapeta', W.wallpaper, 'malovaný damašek')}
      <label class="fld"><span>Dlaždice na stěně (px stěny; prostřední obraz má 500)</span><input class="field" data-wall="tileWorld" value="${W.tileWorld ?? 280}" inputmode="numeric" style="max-width:200px"></label>
      ${mediaCard('grime', 'Špína a skvrny', W.grime, 'žádná')}
      <label class="fld"><span>Krytí špíny (0–1)</span><input class="field" data-wall="grimeOpacity" value="${W.grimeOpacity ?? 1}" inputmode="decimal" style="max-width:200px"></label></div>`);
  if (part === 'skrin') return renderCabinet(true);
  if (part === 'dvere') {
    const snd = dr.sound && D().media[dr.sound];
    return frame(`<h1>Úvodní dveře</h1>
    <p class="lead">Úvodní stránka webu: klik na zavřené dveře zahraje vrznutí, ukáže pootevřené dveře a otevře stěnu. Oba snímky musí mít stejný záběr.</p>
    <div class="form">${mediaCard('doorsClosed', 'Zavřené dveře', dr.closed, 'zástupné')}${mediaCard('doorsAjar', 'Pootevřené dveře', dr.ajar, 'zástupné')}
      <div class="media-pick"><span class="thumb checker" style="display:flex;align-items:center;justify-content:center;font-size:22px">♪</span>
        <span class="tx"><b>Vrznutí</b><span class="hint">${snd ? esc(snd.name) : 'bez zvuku'}</span>${snd ? `<audio controls preload="none" src="/media/${dr.sound}/sound${snd.ext}?v=${snd.v || 1}" style="height:30px;margin-top:6px"></audio>` : ''}</span>
        <button class="btn" data-pick="doorsSound">Vybrat…</button><label class="btn">Nahrát .mp3…<input type="file" accept=".mp3,.m4a,.ogg,.wav" data-sound hidden></label>${snd ? '<button class="btn" data-clear="doorsSound">Zrušit</button>' : ''}</div>
      ${mediaCard('doorsFrame', 'Futra kolem dveří', dr.frame, 'žádná')}
      ${dr.frame ? `<div class="row"><span class="hint">${dr.frameOpening ? `Otvor ve futrech: ${Math.round(dr.frameOpening.w * 100)} × ${Math.round(dr.frameOpening.h * 100)} % obrázku – dveře se do něj usadí.` : '<span class="warn">Nakresli otvor, kam patří dveře – do té doby se futra nezobrazí.</span>'}</span>
        <button class="btn" data-act="frame-opening">Nakreslit otvor…</button></div>` : ''}
      <p class="hint">Fotky dveří i futra nahraješ v Knihovně (druh „Skříň / dveře“ → Dveře). Futra jsou jeden obrázek s průhledným otvorem; dveře se do otvoru roztáhnou a futra se kreslí přes jejich okraje.</p></div>`);
  }
  if (part === 'jmenovka') return renderPlates();
  if (part === 'oblozeni') {
    const su = D().surround, num = (k, label) => `<label class="pfx"><span style="width:auto">${label}</span><input data-su="${k}" value="${su[k]}" inputmode="decimal"><span class="hint">px</span></label>`;
    return frame(`<h1>Obložení místnosti</h1>
    <p class="lead">Rám kolem celé místnosti: boky vlevo a vpravo (pravý je zrcadlo levého), římsa nahoře a lambrie dole podél stěny za skříní. Kreslí se podél okrajů místnosti – její velikost nastavíš na Stěně tlačítkem „Velikost místnosti“, a když ji změníš, obložení jde s ní. Boky a římsa jsou nad vším, co visí, lambrie pod tím.</p>
    <div class="form">
      <label class="check"><input type="checkbox" data-su="on"${su.on ? ' checked' : ''}> <b style="font-weight:500">Zobrazit obložení</b></label>
      ${mediaCard('sideTop', 'Bok – hlavice nahoře', su.sideTop, 'žádná')}
      ${mediaCard('sideMid', 'Bok – výplň (opakuje se dolů)', su.sideMid, 'žádná')}
      ${mediaCard('cornice', 'Římsa (opakuje se do šířky)', su.cornice, 'žádná')}
      ${mediaCard('wainscot', 'Lambrie (opakuje se do šířky)', su.wainscot, 'žádná')}
      <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">${num('sideW', 'Šířka boku')}${num('corniceH', 'Výška římsy')}${num('wainscotH', 'Výška lambrie')}</div>
      <p class="hint">Rozměry jsou v px stěny (prostřední obraz má 400). Obrázky nahraješ v Knihovně jako druh „Obložení“.</p></div>`);
  }
  if (part === 'adresa') return frame(`<h1>Adresa a popis</h1>
    <p class="lead">Pro vyhledávače a náhledy sdílených odkazů.</p>
    <div class="form">${field('siteUrl', 'Adresa webu (s lomítkem na konci)', S.siteUrl, 'placeholder="https://cabinet.martinposta.com/"')}
      ${field('customDomain', 'Vlastní doména (CNAME)', S.customDomain, 'placeholder="cabinet.martinposta.com"')}
      <label class="fld"><span>Popis webu (anglicky)</span><textarea class="field" rows="3" data-s="description" maxlength="300">${esc(S.description)}</textarea></label>
      <label class="check"><input type="checkbox" data-ni${S.noindex ? ' checked' : ''}> <span><b style="font-weight:500">Skrýt před vyhledávači (noindex)</b><br><span class="hint">Měkké spuštění: web je veřejný, ale Google a spol. ho nezařadí a nevznikne sitemap. Před ostrým spuštěním vypni.</span></span></label></div>`);
  if (part === 'efekty') {
    const fx = S.fx || {}, hc = D().handCandle || {};
    const sw = (k, t, h) => `<label class="check"><input type="checkbox" data-fx="${k}"${fx[k] !== false ? ' checked' : ''}> <span><b style="font-weight:500">${t}</b><br><span class="hint">${h}</span></span></label>`;
    return frame(`<h1>Světlo a efekty</h1>
    <p class="lead">Každý efekt jde vypnout zvlášť. Na rychlé porovnání bez ukládání stačí na webu přidat k adrese <code>?fx=none</code> nebo třeba <code>?fx=dark,lips</code>.</p>
    <div class="form"><div class="fx-list">
      ${sw('darkness', 'Tma a světlo svíčky', 'bez ní není ani stín rámu (dark)')}
      ${sw('castShadows', 'Stíny od svíčky na stěně', 'cast')}
      ${sw('frameLips', 'Stín rámu uvnitř obrazu', 'lips')}
      ${sw('roomCandleShadows', 'Stíny od svíček v místnosti', 'room, pokus D12')}
      ${sw('handCandle', 'Svíčka místo kurzoru', 'candle')}</div>
      ${mediaCard('handCandle', 'Obrázek svíčky', hc.media, 'žádný')}
      <div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <label class="pfx"><span style="width:auto">Plamen X</span><input data-hc="fx" value="${hc.fx ?? 0.5}"></label>
        <label class="pfx"><span style="width:auto">Plamen Y</span><input data-hc="fy" value="${hc.fy ?? 0.15}"></label>
        <label class="pfx"><span style="width:auto">Výška px</span><input data-hc="height" value="${hc.height ?? 118}"></label></div></div>`);
  }
  if (part === 'statistika') return frame(`<h1>Statistika</h1>
    <p class="lead">Cloudflare Web Analytics: bez cookies, na localhostu se nepočítá. Prázdné = žádná statistika.</p>
    <div class="form">${field('analyticsToken', 'Token', S.analyticsToken, 'placeholder="32 znaků 0–9 a a–f" spellcheck="false"')}</div>`);
}

// ---------- nameplate and plaques: graphics, type, colours, with a live preview ----------
const FONT_OPTS = [['display', 'IM Fell English'], ['italic', 'IM Fell English – kurzíva'], ['label', 'IM Fell English SC (kapitálky)'], ['body', 'Spectral']];
function renderPlates() {
  const S = D().settings, { nameplate: NP, plaque: PQ } = D().plates;
  const sel = (part, k, v) => `<select class="field" data-pl="${part}.${k}">${FONT_OPTS.map(([id, l]) => `<option value="${id}"${id === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const num = (part, k, v, label, unit = 'px') => `<label class="pfx"><span style="width:auto">${label}</span><input data-pl="${part}.${k}" value="${v}" inputmode="decimal"><span class="hint">${unit}</span></label>`;
  const col = (part, k, v) => `<input type="color" data-pl="${part}.${k}" value="${v}" class="swatch">`;
  const eng = (part, v) => `<label class="check"><input type="checkbox" data-pl="${part}.engraved"${v !== false ? ' checked' : ''}> Ryté písmo (světlá hrana pod textem)</label>`;
  frame(`<h1>Jmenovka a štítky</h1>
    <p class="lead">Jmenovka visí nad prostředním obrazem, štítky s číslem pod exponáty. Obě můžou mít vlastní grafiku – obrázek druhu „Cedulka“ z Knihovny; text na nich zůstává živý. Polohu jmenovky měníš na Stěně.</p>
    <div class="plates-ed">
      <div class="form">
        <h2 class="sub">Jmenovka</h2>
        ${field('plateTitle', 'Nadpis', S.plateTitle, 'maxlength="60"')}${field('plateSubtitle', 'Podtitul (za ním web doplní počet exponátů)', S.plateSubtitle, 'maxlength="80"')}
        ${mediaCard('nameplate', 'Grafika jmenovky', NP.media, 'malovaná mosaz')}
        <div class="grid2">${num('nameplate', 'w', NP.w, 'Šířka')}${num('nameplate', 'dy', NP.dy, 'Posun textu dolů')}</div>
        <div class="fontrow"><span>Nadpis</span>${sel('nameplate', 'font', NP.font)}${num('nameplate', 'size', NP.size, 'Velikost')}${col('nameplate', 'color', NP.color)}</div>
        <div class="fontrow"><span>Podtitul</span>${sel('nameplate', 'subFont', NP.subFont)}${num('nameplate', 'subSize', NP.subSize, 'Velikost')}${col('nameplate', 'subColor', NP.subColor)}</div>
        ${eng('nameplate', NP.engraved)}
        <h2 class="sub">Štítky pod exponáty</h2>
        ${mediaCard('plaque', 'Grafika štítku', PQ.media, 'malovaná mosaz')}
        ${PQ.media ? `<div class="grid2">${num('plaque', 'ends', PQ.ends, 'Okraje', '%')}</div>
          <p class="hint">Okraje: kolik procent obrázku z každé strany zůstane nedeformovaných (šrouby, rohy). Prostředek se natáhne podle délky názvu.</p>` : ''}
        <div class="fontrow"><span>Text</span>${sel('plaque', 'font', PQ.font)}${num('plaque', 'size', PQ.size, 'Velikost')}${col('plaque', 'color', PQ.color)}</div>
        <div class="fontrow"><span>Číslo</span><span></span><span></span>${col('plaque', 'numColor', PQ.numColor)}</div>
        ${eng('plaque', PQ.engraved)}
        <div class="row"><button class="btn" data-act="plates-reset">Vrátit původní vzhled</button></div>
      </div>
      <div class="plates-prev" aria-label="Náhled"><div class="pp-wall" id="pp-wall"></div><p class="hint">Náhled v plném světle, 1 : 2.</p></div>
    </div>`);
  drawPlatePreview();
}
function drawPlatePreview() {
  const box = $('#pp-wall'); if (!box) return;
  const S = D().settings, { nameplate: NP, plaque: PQ } = D().plates, M = D().media;
  const img = NP.media && M[NP.media], W = NP.w, H = img ? Math.round(W * img.h / img.w) : D().nameplate.h;
  const n = D().items.filter(i => i.exhibit && !i.off).length;
  // the site's own elements in a half-size "world": the wall code builds them, nothing is redrawn here
  const world = document.createElement('div'); world.className = 'pp-world';
  const np = makeNameplate(W, H, NP, M, { title: S.plateTitle, line: `${S.plateSubtitle} · ${n} exhibit${n === 1 ? '' : 's'}` });
  np.style.position = 'relative'; np.style.animation = 'none';
  const ex = D().items.find(i => i.exhibit)?.exhibit;
  const pq = document.createElement('div'); pq.className = 'pp-plaque';
  pq.innerHTML = `<div class="plaque"><b>${String(ex?.inv ?? 1).padStart(3, '0')}</b>${esc(ex?.title || 'Time Transit')}</div>`;
  world.append(np, pq);
  plateLook(world, PQ, M);
  box.replaceChildren(world);
}
let plTimer = null;
async function savePlate(t) {
  const [partK, k] = t.dataset.pl.split('.');
  const v = t.type === 'checkbox' ? t.checked : t.type === 'color' ? t.value : t.value.replace(',', '.');
  D().plates[partK][k] = t.type === 'checkbox' || t.type === 'color' ? v : Number(v);
  drawPlatePreview();
  clearTimeout(plTimer);
  plTimer = setTimeout(async () => {
    try { status('saving'); await api('PATCH', '/api/plates', { [partK]: { [k]: v } }); await refresh(); status('ok'); }
    catch (err) { status('err', err.message); await refresh(); }
  }, t.type === 'color' ? 250 : 0);
}

// ---------- the cabinet: drawers drawn on the body photo ----------
let drawers = [], picked = 0, drawing = false;
// reload: take the drawers from the data (on show and after a save); otherwise keep the local copy that a
// drag is editing – re-reading it mid-drag made the drag edit an object nobody saved
function renderCabinet(reload = false) {
  const C = D().cabinet, body = C.body && D().media[C.body];
  if (reload) drawers = structuredClone(C.drawers || []);
  if (picked >= drawers.length) picked = drawers.length - 1;
  const inside = i => D().items.filter(it => it.drawer === i && !it.off);
  const cards = drawers.map((d, i) => {
    const f = d.front && D().media[d.front], items = inside(i);
    return `<div class="drw-card${i === picked ? ' on' : ''}" data-dc="${i}">
      <div class="row" style="justify-content:space-between"><b>${i + 1}</b>${f ? `<span class="hint">čelo ${esc(f.name)}</span>` : '<span class="warn">chybí fotka čela</span>'}</div>
      <span class="hint" style="color:var(--ink-soft)">${items.length ? 'Uvnitř: ' + items.map(it => esc(itemName(it)) + (it.exhibit ? ` (${String(it.exhibit.inv).padStart(3, '0')})` : '')).join(', ') : 'prázdný'}</span>
      ${i === picked ? `<div class="grid4">${['x', 'y', 'w', 'h'].map(k => `<label class="pfx"><span>${{ x: 'X', y: 'Y', w: 'Š', h: 'V' }[k]}</span><input data-dn="${k}" value="${Math.round(d[k])}"></label>`).join('')}</div>
        <div class="row"><button class="btn sm" data-front="${i}">Změnit čelo…</button><button class="btn sm danger" data-del-drawer="${i}">Smazat šuplík</button></div>` : ''}
    </div>`;
  }).join('');
  frame(`<div class="row" style="gap:12px;align-items:baseline"><h1>Skříň a šuplíky</h1>
      <span class="lead">Šuplíky kresli a posouvej přímo na fotce korpusu. Oranžová čára je konec stránky – pod ni návštěvník nikdy nedojede.</span></div>
    <div class="cab-wrap${drawing ? ' drawing' : ''}">
      <div class="cab-board">${body ? `<div class="cab-photo-ed" id="cab-ed"><img src="${mediaSrc(C.body, body.widths[body.widths.length - 1])}" alt="Korpus skříně"></div>`
        : '<p class="hint">Skříň je zatím malovaná. Vyber fotku korpusu vpravo a šuplíky pak nakreslíš na ni.</p>'}</div>
      <div class="drw-cards">
        <div class="card stack">${mediaCard('cabinetBody', 'Korpus', C.body, 'malovaný')}${mediaCard('tray', 'Samet uvnitř', C.tray, 'malovaný')}</div>
        ${body ? `<div class="row" style="justify-content:space-between;padding:4px 2px"><b>Šuplíky</b><button class="btn${drawing ? ' primary' : ''}" data-act="draw">${drawing ? 'Táhni na fotce…' : '+ Nakreslit šuplík'}</button></div>
        ${cards || '<p class="hint">Zatím žádný šuplík.</p>'}
        <div class="row"><span class="hint">Konec stránky: ${C.cutY != null ? `${Math.round(C.cutY)} px od horní desky` : 'automaticky (nad spodkem nejnižšího šuplíku)'}</span>${C.cutY != null ? '<button class="btn sm" data-act="cut-auto">Automaticky</button>' : ''}</div>` : ''}
      </div>
    </div>`);
  const img = $('#cab-ed img');
  if (img) { img.onload = drawOverlay; if (img.complete) drawOverlay(); }
}
const kScale = () => { const img = $('#cab-ed img'); return img ? img.clientWidth / (D().cabinet.w || 1260) : 1; };
function cutY() {
  const C = D().cabinet;
  if (C.cutY != null) return C.cutY;
  return drawers.length ? Math.max(...drawers.map(d => d.y + d.h)) - 26 : (D().cabinet.w || 1260) * 0.6;
}
function drawOverlay() {
  const ed = $('#cab-ed'); if (!ed) return;
  const k = kScale();
  $$('.drw, .cutl, .cutfade', ed).forEach(n => n.remove());
  drawers.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'drw' + (i === picked ? ' on' : ''); el.dataset.i = i;
    el.style.cssText = `left:${d.x * k}px;top:${d.y * k}px;width:${d.w * k}px;height:${d.h * k}px`;
    el.innerHTML = `<span class="n">${i === picked ? `Šuplík ${i + 1}` : i + 1}</span><span class="rz" data-rz></span>`;
    ed.appendChild(el);
  });
  const y = cutY() * k;
  ed.insertAdjacentHTML('beforeend', `<div class="cutl" style="top:${y}px"><span>konec stránky · táhni</span></div><div class="cutfade" style="top:${y + 2}px"></div>`);
}
function onCabDown(e) {
  const ed = $('#cab-ed'); if (!ed || !ed.contains(e.target)) return;
  e.preventDefault();
  const k = kScale(), r = ed.getBoundingClientRect(), wx = x => (x - r.left) / k, wy = y => (y - r.top) / k;
  const C = D().cabinet, maxW = C.w || 1260, maxH = ed.clientHeight / k;
  const clampD = d => { d.w = Math.max(30, Math.min(d.w, maxW)); d.h = Math.max(30, Math.min(d.h, maxH)); d.x = Math.max(0, Math.min(d.x, maxW - d.w)); d.y = Math.max(0, Math.min(d.y, maxH - d.h)); return d; };
  let move, done;
  if (e.target.closest('.cutl')) {
    move = ev => { const v = Math.max(20, Math.min(maxH, wy(ev.clientY))); $('.cutl', ed).style.top = v * k + 'px'; $('.cutfade', ed).style.top = v * k + 2 + 'px'; done = v; };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); if (done != null) saveCabinet({ cutY: Math.round(done) }); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
    return;
  }
  const hit = e.target.closest('.drw');
  if (drawing && !hit) {
    const x0 = wx(e.clientX), y0 = wy(e.clientY), d = { x: x0, y: y0, w: 1, h: 1, front: null };
    drawers.push(d); picked = drawers.length - 1;
    move = ev => { const x1 = wx(ev.clientX), y1 = wy(ev.clientY); Object.assign(d, { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }); drawOverlay(); };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); drawing = false;
      if (d.w < 30 || d.h < 30) { drawers.pop(); picked = Math.max(0, drawers.length - 1); status('err', 'Šuplík je moc malý (nejmíň 30 × 30 px stěny)'); return renderCabinet(); }
      clampD(d); saveDrawers(); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
    return;
  }
  if (!hit) return;
  const i = Number(hit.dataset.i), d = drawers[i], start = { ...d }, sx = e.clientX, sy = e.clientY, rz = !!e.target.closest('[data-rz]');
  if (picked !== i) { picked = i; renderCabinet(); }
  let moved = false;
  move = ev => {
    const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k; moved = moved || Math.hypot(dx, dy) * k > 2;
    if (rz) Object.assign(d, { w: start.w + dx, h: start.h + dy }); else Object.assign(d, { x: start.x + dx, y: start.y + dy });
    clampD(d); drawOverlay();
  };
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); if (moved) saveDrawers(); };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
}

// ---------- saving ----------
async function saveCabinet(patch) {
  try { status('saving'); await api('PATCH', '/api/cabinet', patch); await refresh(); status('ok'); }
  catch (err) { status('err', err.message); render(); }
}
const saveDrawers = () => saveCabinet({ drawers: drawers.map(d => ({ front: d.front || null, x: r2(d.x), y: r2(d.y), w: r2(d.w), h: r2(d.h) })) });
async function setRole(role, id) {
  try {
    if (role === 'nameplate' || role === 'plaque') await api('PATCH', '/api/plates', { [role]: { media: id } });
    else if (SU_ROLES.includes(role)) await api('PATCH', '/api/surround', { [role]: id });
    else if (role === 'handCandle') { const hc = D().handCandle || {}; await api('PUT', '/api/hand-candle', { media: id, fx: hc.fx ?? 0.5, fy: hc.fy ?? 0.15, height: hc.height ?? 118 }); }
    else await api('POST', '/api/roles', { role, media: id });
    await refresh(); status('ok');
  } catch (err) { status('err', err.message); }
}
async function deleteDrawer(i) {
  const items = D().items.filter(it => it.drawer === i && !it.off);
  if (!confirm(items.length ? `V šuplíku ${i + 1} je ${items.map(itemName).join(', ')}. Přesune se na skříň. Smazat šuplík?` : `Smazat šuplík ${i + 1}?`)) return;
  // what was inside goes onto the cabinet top; the drawers after it move up one number
  commit('drawer-delete', Dd => {
    for (const it of Dd.items) {
      if (it.drawer === i) { delete it.drawer; delete it.dx; delete it.dy; it.on = 'cabinet'; it.x = Dd.cabinet.x; it.y = Dd.cabinet.top - 60; }
      else if (it.drawer > i) it.drawer--;
    }
  });
  await flush();
  drawers.splice(i, 1); picked = Math.max(0, i - 1);
  await saveDrawers();
}

async function onClick(e) {
  const p = e.target.closest('[data-pick]');
  if (p) {
    const role = p.dataset.pick;
    const kinds = { doorsFrame: ['doors'], sideTop: ['surround'], sideMid: ['surround'], cornice: ['surround'], wainscot: ['surround'], nameplate: ['plate'], plaque: ['plate'], wallpaper: ['tile'], grime: ['grime'], cabinetBody: ['cabinet'], tray: ['tray'], doorsClosed: ['doors'], doorsAjar: ['doors'], doorsSound: ['sound'], handCandle: ['item'] }[role];
    const cur = { doorsFrame: D().doors?.frame, sideTop: D().surround.sideTop, sideMid: D().surround.sideMid, cornice: D().surround.cornice, wainscot: D().surround.wainscot, nameplate: D().plates.nameplate.media, plaque: D().plates.plaque.media, wallpaper: D().wall.wallpaper, grime: D().wall.grime, cabinetBody: D().cabinet.body, tray: D().cabinet.tray, doorsClosed: D().doors?.closed, doorsAjar: D().doors?.ajar, doorsSound: D().doors?.sound, handCandle: D().handCandle?.media }[role];
    const id = await pickMedia({ title: p.closest('.media-pick').querySelector('b').textContent, kinds, current: cur });
    if (id) setRole(role, id);
    return;
  }
  const c = e.target.closest('[data-clear]'); if (c) return setRole(c.dataset.clear, null);
  const card = e.target.closest('[data-dc]');
  const fr = e.target.closest('[data-front]');
  if (fr) {
    const i = Number(fr.dataset.front);
    const id = await pickMedia({ title: `Čelo šuplíku ${i + 1}`, kinds: ['drawer'], current: drawers[i].front });
    if (id) { drawers[i].front = id; saveDrawers(); }
    return;
  }
  const del = e.target.closest('[data-del-drawer]'); if (del) return deleteDrawer(Number(del.dataset.delDrawer));
  if (card && !e.target.closest('input, button')) { picked = Number(card.dataset.dc); return renderCabinet(); }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'draw') { drawing = !drawing; return renderCabinet(); }
  if (act === 'cut-auto') return saveCabinet({ cutY: '' });
  if (act === 'frame-opening') {
    const dr = D().doors, m = D().media[dr.frame];
    const r = await rectDialog({ title: 'Otvor ve futrech', single: true, src: mediaSrc(dr.frame, m.widths[m.widths.length - 1]), rects: dr.frameOpening ? [dr.frameOpening] : [],
      hint: 'Tažením nakresli otvor, do kterého patří dveře – dveře se roztáhnou přesně na něj a futra se nakreslí přes jejich okraje. Rámeček přetáhneš, rohy změníš velikost, šipky ho posunou.' });
    if (!r) return;
    try { await api('PATCH', '/api/doors', { frameOpening: r[0] || null }); await refresh(); status('ok', r[0] ? 'Otvor uložený' : 'Otvor smazaný'); } catch (err) { status('err', err.message); }
  }
  if (act === 'plates-reset' && confirm('Vrátit jmenovce i štítkům původní malovanou mosaz a písmo? Texty zůstanou.')) {
    try { await api('PATCH', '/api/plates', { reset: true }); await refresh(); status('ok', 'Původní vzhled vrácen'); } catch (err) { status('err', err.message); }
  }
}
async function onChange(e) {
  const t = e.target;
  try {
    if (t.dataset.pl) return savePlate(t);
    if (t.dataset.su) { await api('PATCH', '/api/surround', { [t.dataset.su]: t.type === 'checkbox' ? t.checked : t.value.replace(',', '.') }); await refresh(); return status('ok'); }
    if (t.dataset.s) { await api('PATCH', '/api/settings', { [t.dataset.s]: t.value }); await refresh(); status('ok'); }
    else if (t.dataset.wall) { await api('PATCH', '/api/wall', { [t.dataset.wall]: t.value.replace(',', '.') }); await refresh(); status('ok'); }
    else if ('ni' in t.dataset) { await api('PATCH', '/api/settings', { noindex: t.checked }); await refresh(); status('ok'); }
    else if (t.dataset.fx) { await api('PATCH', '/api/settings', { fx: { [t.dataset.fx]: t.checked } }); await refresh(); status('ok'); }
    else if (t.dataset.hc) {
      const hc = D().handCandle; if (!hc?.media) return status('err', 'Nejdřív vyber obrázek svíčky');
      await api('PUT', '/api/hand-candle', { ...hc, [t.dataset.hc]: t.value.replace(',', '.') }); await refresh(); status('ok');
    } else if (t.dataset.dn) {
      const v = Number(t.value.replace(',', '.')); if (!Number.isFinite(v)) return status('err', 'Čekám číslo');
      drawers[picked][t.dataset.dn] = v; await saveDrawers();
    } else if (t.matches('[data-sound]')) {
      const f = t.files[0]; t.value = ''; if (!f) return;
      status('saving', 'Nahrávám zvuk…');
      const r = await api('POST', `/api/sound?name=${encodeURIComponent(f.name)}`, undefined, f);
      await api('POST', '/api/roles', { role: 'doorsSound', media: r.id });
      await refresh(); status('ok', r.warning || 'Vrznutí nahráno');
    }
  } catch (err) { status('err', err.message); render(); }
}

// ---------- section life cycle ----------
export function init() {
  root().addEventListener('click', onClick);
  root().addEventListener('change', onChange);
  // colours repaint the preview while the picker is still open; the save waits for 'change'
  root().addEventListener('input', e => { const t = e.target; if (t.dataset.pl && t.type === 'color') { const [p, k] = t.dataset.pl.split('.'); D().plates[p][k] = t.value; drawPlatePreview(); } });
  root().addEventListener('pointerdown', onCabDown);
  addEventListener('resize', () => { if (!root().hidden && part === 'skrin') drawOverlay(); });
  on('data', () => { if (!root().hidden) render(); });
  stopPointer(root());
}
export function show(arg) {
  if (arg && PARTS.some(([, l]) => l.some(([k]) => k === arg))) part = arg;
  const h = `#mistnost/${part}`;
  if (location.hash !== h) history.replaceState(null, '', h);
  drawing = false;
  render();
}
