// The phone version of the cabinet (main.js decides, Martin 2026-11-19): no wall, no camera, no
// candlelight. The wallpaper scrolls with the exhibits (standing still, it made them seem to float
// above it – Martin), the nameplate on
// top, and under it the exhibits one below another by inventory number – each at a size proportional to
// its size on the wall (the largest takes 90 % of the screen, none goes under 45 %), with its brass plaque.
// A tap opens the same detail as on the wall (routing.js); its × and the system back both close it.
// Decorations, the cabinet, drawers, shelves and the surround are not shown.

import { runtimeItem, makeNameplate, plateLook, plaqueText } from './wall.js';
import { mediaImg, mediaUrl } from './media.js';
import { exhibitRouter } from './routing.js';

export function startMobile(data) {
  const MEDIA = data.media || {}, S = data.settings, vw = document.documentElement.clientWidth || innerWidth;
  document.documentElement.classList.add('mobile');
  document.body.classList.add('mobile');

  // the exhibits that have a real image (painted stand-ins only exist before Martin's own assets)
  const exhibits = data.items.map((d, i) => runtimeItem(d, i, MEDIA)).filter(it => it.work && it.m)
    .sort((a, b) => Number(a.inv) - Number(b.inv));
  // one scale for everything: world px → screen px, so sizes keep their proportions (wallpaper too)
  const maxW = Math.max(1, ...exhibits.map(it => it.aw)), k = vw * 0.9 / maxW;
  const widthOf = it => Math.round(Math.min(vw * 0.9, Math.max(vw * 0.45, it.aw * k)));

  const list = document.createElement('main');
  list.className = 'm-list'; list.setAttribute('aria-label', 'Exhibits');
  // the wallpaper is the list's own background, so it scrolls together with what hangs on it
  const tid = data.wall?.wallpaper, tile = tid && MEDIA[tid];
  if (tile) {
    const t = (data.wall.tileWorld || 280) * k;
    list.style.backgroundImage = `url("${new URL(mediaUrl(tid, tile, tile.widths[tile.widths.length - 1]), document.baseURI).href}")`;
    list.style.backgroundSize = `${t.toFixed(1)}px auto`;
  }
  plateLook(list, data.plates?.plaque || {}, MEDIA);

  // the nameplate, made by the wall's own code and scaled down to the screen
  const NP = data.plates?.nameplate || {}, npImg = NP.media && MEDIA[NP.media];
  const W = NP.w || data.nameplate.w, H = npImg ? Math.round(W * npImg.h / npImg.w) : data.nameplate.h, s = Math.min(1, (vw - 32) / W);
  const n = exhibits.length;
  const plate = makeNameplate(W, H, NP, MEDIA, { title: S.plateTitle, line: `${S.plateSubtitle} · ${n} exhibit${n === 1 ? '' : 's'}` });
  plate.style.transform = `scale(${s})`;
  const pw = document.createElement('div');
  pw.className = 'm-plate'; pw.style.width = `${W * s}px`; pw.style.height = `${H * s}px`;
  pw.appendChild(plate); list.appendChild(pw);

  const router = exhibitRouter({ data, ui: { viewerOpen: false }, exhibits, query: location.search,
    // back from a detail opened by a link: show where that exhibit is in the list
    onClose: it => { const r = it?.fig?.getBoundingClientRect(); if (r && (r.bottom < 0 || r.top > innerHeight)) it.fig.scrollIntoView({ block: 'center' }); } });

  for (const it of exhibits) {
    const fig = document.createElement('figure');
    fig.className = 'm-ex';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'm-pic';
    btn.setAttribute('aria-label', `${it.title}${it.medium ? ', ' + it.medium : ''}. Open the gallery`);
    const w = widthOf(it), im = mediaImg(it.mediaId, it.m, w, '');
    im.style.width = `${w}px`; im.loading = 'lazy';
    btn.appendChild(im);
    btn.addEventListener('click', () => router.open(it, true));
    fig.appendChild(btn);
    if (it.plaque) {
      const p = document.createElement('figcaption');
      p.className = 'plaque';
      p.innerHTML = plaqueText(it.inv); p.setAttribute('aria-hidden', 'true');   // the number only (8c)
      fig.appendChild(p);
    }
    it.fig = fig;
    list.appendChild(fig);
  }
  document.body.appendChild(list);

  // an exhibit page (e/<slug>/) opens straight into its exhibit, the list behind it in place
  if (router.start) { router.start.fig.scrollIntoView({ block: 'center' }); router.open(router.start, false); }
}
