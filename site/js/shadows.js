// Light and shadow (PLAN phase 6). Everything per-frame happens in canvases, nothing re-rasterises #world:
//  - cast shadows: one half-resolution canvas between the wallpaper and #world. Every item gets one small,
//    blurred silhouette sprite (made here once its image has loaded); each frame draws it pushed away
//    from the hand candle – longer and fainter with distance. Redrawn only when the view or the candle moved.
//  - room candles (D12, settings.roomCandleShadows): candles placed in the room cast *static* shadows,
//    computed once; where a room candle lights an item, the hand candle's shadow there is weakened by the
//    same falloff, or it would read as a black hole in a lit patch.
//  - frame lips: inside a frame's opening, a soft dark band along the edge that faces the hand candle,
//    painted into the existing quarter-res darkness canvas and clipped to the opening.

const RES = 2;            // shadow canvas: 1 px per 2 screen px
const BLUR = 18;          // world px of softness baked into every silhouette
const SPRITE_MAX = 192;   // longest side of a silhouette sprite, px
const HAND_REACH = 1000;  // screen px where the hand candle's shadows have faded out

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const falloff = (d, reach) => clamp(1 - d / reach, 0, 1) ** 1.5;

// ---------- silhouettes ----------

const canBlur = (() => { const c = document.createElement('canvas').getContext('2d'); return 'filter' in c && (c.filter = 'blur(2px)', c.filter === 'blur(2px)'); })();

/** Paints `drawShape(ctx)` (in world units, w×h) as a soft black silhouette; returns the sprite. */
function sprite(w, h, drawShape) {
  const s = Math.min(1, SPRITE_MAX / Math.max(w, h)), pad = BLUR * 2;
  const W = Math.ceil((w + 2 * pad) * s), H = Math.ceil((h + 2 * pad) * s);
  const shape = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const c = shape.getContext('2d');
  c.setTransform(s, 0, 0, s, pad * s, pad * s);
  drawShape(c);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-in'; c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const out = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const o = out.getContext('2d');
  if (canBlur) { o.filter = `blur(${Math.max(1, BLUR * s * 0.8)}px)`; o.drawImage(shape, 0, 0); }
  else {
    // no canvas filter (older Safari): blur by shrinking and stretching back
    const k = Math.max(2, Math.round(BLUR * s * 0.8));
    const tiny = Object.assign(document.createElement('canvas'), { width: Math.ceil(W / k), height: Math.ceil(H / k) });
    tiny.getContext('2d').drawImage(shape, 0, 0, tiny.width, tiny.height);
    o.imageSmoothingQuality = 'high'; o.drawImage(tiny, 0, 0, W, H);
  }
  return { canvas: out, w: w + 2 * pad, h: h + 2 * pad };
}

const ready = img => img && img.complete && img.naturalWidth > 0;

// One silhouette per thing, shared: the static shadows make them at load (after each image decodes) and
// the cast shadows reuse them. Before, the cast shadows built their own on the first pan over a part of
// the wall – ~5 ms each, several in one frame – which made that first pan hitch.
const SPRITES = new Map();
function spriteFor(key, w, h, shape) {
  const k = `${key}|${Math.round(w)}x${Math.round(h)}`;
  if (!SPRITES.has(k)) SPRITES.set(k, sprite(w, h, shape));
  return SPRITES.get(k);
}

function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); c.fill(); }

/** The nameplate's silhouette: its "plate" image when it has one (alpha), else the painted cartouche. */
function plateShape(P) {
  return () => {
    const img = document.querySelector('.nameplate')?.img;
    if (!img) return c => roundRect(c, 0, 0, P.w, P.h, 26);
    return ready(img) ? c => c.drawImage(img, 0, 0, P.w, P.h) : null;
  };
}
/** How an item's silhouette is drawn, or null while its image has not loaded yet. */
function shapeOf(it) {
  const w = it.ow ?? it.aw, h = it.oh ?? it.ah;
  if (it.m) { const img = it.el; return ready(img) ? c => c.drawImage(img, 0, 0, w, h) : null; }
  if (it.cabTop) return ready(it.img) ? c => c.drawImage(it.img, 0, 0, w, h) : null;
  if (it.shelf) {
    if (!ready(it.img)) return null;
    // plank + the object standing on it (brackets are too thin to matter)
    return c => { c.fillRect(0, h - 62, w, 18); c.drawImage(it.img, (w - it.aw) / 2, h - 60 - it.ah, it.aw, it.ah); };
  }
  if (it.shape === 'oval' || it.shape === 'circle') return c => { c.beginPath(); c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 7); c.fill(); };
  if (it.shape === 'arch') return c => { c.beginPath(); c.moveTo(0, h); c.lineTo(0, w / 2); c.arc(w / 2, w / 2, w / 2, Math.PI, 0); c.lineTo(w, h); c.fill(); };
  return c => roundRect(c, 0, 0, w, h, 3);
}

/** Where the picture sits inside an item (fractions); placeholder frames know theirs from the geometry. */
function openingOf(it) {
  if (it.opening) return it.opening;
  if (it.m || it.shelf || it.cabTop) return null;
  const ix = (it.fw + 6) / it.ow, iy = (it.fw + 6) / it.oh;
  return { shape: it.shape === 'oval' || it.shape === 'circle' ? 'oval' : 'rect', x: ix, y: iy, w: 1 - 2 * ix, h: 1 - 2 * iy };
}

// ---------- the module ----------

export function createShadows({ canvas, wall, roomCandles = true }) {
  const ctx = canvas.getContext('2d');
  const size = () => { canvas.width = Math.ceil(innerWidth / RES); canvas.height = Math.ceil(innerHeight / RES); };
  size(); addEventListener('resize', size);

  // casters in world coordinates: hung items, objects on the cabinet, the nameplate, the cabinet itself
  const casters = [];
  for (const it of wall.items) {
    if (it.drawer != null) continue;                    // inside a closed drawer: nothing to cast
    if (it.on === 'cabinet') { it.cabTop = true; casters.push({ it, key: 'i:' + it.id, x: it.wx, y: it.wy, w: it.aw, h: it.ah, rot: (it.rotation || 0) * Math.PI / 180 }); }
    else casters.push({ it, key: 'i:' + it.id, x: it.x, y: it.y, w: it.ow, h: it.oh, rot: it.m || !it.shelf ? (it.rotation || 0) * Math.PI / 180 : 0 });
  }
  const P = wall.PLATE;
  casters.push({ key: 'plate', x: P.x, y: P.y, w: P.w, h: P.h, rot: 0, plateShape: plateShape(P) });
  const C = wall.CAB, ch = wall.CUT_Y - C.top + 400;
  casters.push({ key: 'cabinet', x: C.cx, y: C.top + ch / 2, w: C.w, h: ch, rot: 0, shape: c => roundRect(c, 0, 0, C.w, ch, 4) });

  // static room-candle shadows (D12): offsets and strengths computed once
  const flames = (wall.candleFlames || []).map(([x, y, reach = 340]) => ({ x, y, reach: reach * 1.6 }));
  for (const k of casters) {
    k.room = []; k.roomLight = 0;
    if (!roomCandles) continue;
    for (const f of flames) {
      // a candle does not shadow the thing it stands on or in
      if (Math.abs(f.x - k.x) < k.w / 2 && Math.abs(f.y - k.y) < k.h / 2) continue;
      const dx = k.x - f.x, dy = k.y - f.y, d = Math.hypot(dx, dy) || 1, a = falloff(d, f.reach);
      if (a <= 0) continue;
      const len = clamp(d * 0.08, 4, 50);
      k.room.push({ ox: dx / d * len, oy: dy / d * len, a: 0.5 * a });
      k.roomLight = Math.max(k.roomLight, a);
    }
  }

  // hung items fade in one after another (hangIn, --i × 75 ms): a shadow must not arrive before its item,
  // so it waits until the item's own animation has ended (Martin saw shadows first, pictures after)
  // – the same arrived() the static shadows use: a clock computed from the CSS delay drifted from the
  // animation's own clock, and the frame lips came in while their pictures were still arriving
  for (const k of casters) {
    const el = k.it?.el?.closest?.('.hang') || (k.key === 'plate' ? document.querySelector('.nameplate') : null);
    k.waiting = true;
    arrived(el).then(() => { k.waiting = false; missing = true; });
  }
  let missing = true; // some visible caster had no sprite yet (its image was still loading)
  function ensureSprite(k) {
    if (k.sprite || k.failed) return k.sprite;
    const shape = k.shape || (k.plateShape ? k.plateShape() : shapeOf(k.it));
    if (!shape) return null;
    try { k.sprite = spriteFor(k.key, k.w, k.h, shape); } catch { k.failed = true; }
    return k.sprite;
  }

  function draw({ cam, vw, vh, lx, ly, changed }) {
    if (!changed && !missing) return;
    missing = false;
    const W = canvas.width, H = canvas.height, z = cam.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    for (const k of casters) {
      const sx = vw / 2 + (k.x - cam.x) * z, sy = vh / 2 + (k.y - cam.y) * z;
      const r = Math.max(k.w, k.h) * z;
      if (sx + r < -100 || sx - r > vw + 100 || sy + r < -100 || sy - r > vh + 100) continue;
      if (k.waiting) { missing = true; continue; }
      const sp = ensureSprite(k); if (!sp) { if (!k.failed) missing = true; continue; }
      const put = (ox, oy, a, grow = 1) => {
        if (a < 0.01) return;
        ctx.globalAlpha = a;
        ctx.setTransform(1 / RES, 0, 0, 1 / RES, (sx + ox) / RES, (sy + oy) / RES);
        if (k.rot) ctx.rotate(k.rot);
        const w = sp.w * z * grow, h = sp.h * z * grow;
        ctx.drawImage(sp.canvas, -w / 2, -h / 2, w, h);
      };
      for (const s of k.room) put(s.ox * z, s.oy * z, s.a);
      // the hand candle: pushed away from the flame, longer and a little larger when the flame is close
      const dx = sx - lx, dy = sy - ly, d = Math.hypot(dx, dy) || 1;
      const len = clamp(d * 0.11, 0, 90), near = clamp(1 - d / HAND_REACH, 0, 1);
      put(dx / d * len, dy / d * len, 0.62 * near * (1 - 0.75 * k.roomLight), 1 + 0.06 * near);
    }
    ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // frame lips, painted into the darkness canvas (k = its scale, 1/4)
  const lipped = casters.filter(c => c.it && openingOf(c.it));
  function lips(d, k, { cam, vw, vh, lx, ly }) {
    const z = cam.z;
    for (const c of lipped) {
      const o = openingOf(c.it), w = c.w * z, h = c.h * z;
      const ox = (o.x + o.w / 2 - 0.5) * w, oy = (o.y + o.h / 2 - 0.5) * h, hw = o.w * w / 2, hh = o.h * h / 2;
      // measured from the opening's own centre: a flame right in front of the picture lights it
      // straight on and the lip throws no shadow – without this the band spun round with the cursor
      const sx = vw / 2 + (c.x - cam.x) * z, sy = vh / 2 + (c.y - cam.y) * z;
      const dx = lx - (sx + ox), dy = ly - (sy + oy), dist = Math.hypot(dx, dy) || 1;
      const side = clamp(dist / (Math.max(hw, hh) * 1.3), 0, 1) ** 1.5;
      // like the other shadows, the lip waits for its picture: loaded and done arriving (hangIn), then
      // fades in over 0.45 s – it used to darken an empty frame before the picture was there
      const now = performance.now();
      if (!c.litAt) {
        if (c.waiting || (c.it.m && !ready(c.it.el))) continue;
        c.litAt = now;
      }
      const a = 0.275 * clamp(1 - dist / 900, 0, 1) * side * clamp((now - c.litAt) / 450, 0, 1);
      if (a < 0.02) continue;
      d.save();
      d.setTransform(k, 0, 0, k, sx * k, sy * k);
      if (c.rot) d.rotate(c.rot);
      d.translate(ox, oy);
      d.beginPath();
      if (o.shape === 'oval') d.ellipse(0, 0, hw, hh, 0, 0, 7); else d.rect(-hw, -hh, 2 * hw, 2 * hh);
      d.clip();
      // the band starts at the edge facing the flame and fades towards the far side
      const ux = dx / dist, uy = dy / dist;
      // depth and strength are both half of the first version (min side · 0.35 + 6, alpha .55): that band
      // read as a much deeper box than a real frame
      const ex = ux * hw, ey = uy * hh, depth = (Math.min(hw, hh) * 0.175 + 3) * (0.4 + 0.6 * side);
      const g = d.createLinearGradient(ex, ey, ex - ux * depth, ey - uy * depth);
      g.addColorStop(0, `rgba(0,0,0,${a.toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g; d.fillRect(-hw, -hh, 2 * hw, 2 * hh);
      d.restore();
    }
  }

  return { draw, lips };
}

// ---------- static shadows ----------

/**
 * A soft shadow under every hung item, object on the cabinet and the nameplate, as plain <img>s inside
 * #world, made once from the same silhouettes as the cast shadows. They replace CSS drop-shadow filters:
 * a filter is re-rasterised with every tile of the wall that pans into view, an image is just drawn.
 */
/**
 * Resolves when `el`'s own entrance animation (if any) has finished; at once without one. A timer backs it
 * up: where the animation clock does not run (a page that is not being painted) the shadow still comes.
 */
function arrived(el) {
  const anims = el?.getAnimations?.() || [];
  if (!anims.length) return Promise.resolve();
  const cs = getComputedStyle(el), end = ((parseFloat(cs.animationDelay) || 0) + (parseFloat(cs.animationDuration) || 0)) * 1000;
  return Promise.race([Promise.all(anims.map(a => a.finished)), new Promise(r => setTimeout(r, end + 1500))]).catch(() => {});
}

export function addStaticShadows({ wall, world, offset = 8, opacity = 0.5 }) {
  const todo = [];
  for (const it of wall.items) {
    if (it.drawer != null) continue;
    const img = it.m ? it.el : it.img;
    if (it.on === 'cabinet') {
      it.cabTop = true;
      todo.push({ it, img, w: it.aw, h: it.ah, rot: it.rotation || 0, parent: it.el.parentElement, before: it.el,
        cx: wall.CAB.w / 2 + it.x, cy: 4 - it.ah / 2 });
    } else {
      const hang = it.el.closest('.hang');
      todo.push({ it, img, w: it.ow, h: it.oh, rot: (it.m || !it.shelf) ? it.rotation || 0 : 0, parent: world, before: hang, cx: it.x, cy: it.y, hang });
    }
  }
  const plate = world.querySelector('.nameplate'), P = wall.PLATE;
  if (plate) todo.push({ img: plate.img, w: P.w, h: P.h, rot: 0, parent: world, before: plate, cx: P.x, cy: P.y, shape: () => plateShape(P)(), hang: plate });

  const make = async t => {
    if (t.img) { try { await t.img.decode(); } catch { return; } }
    const shape = t.shape ? t.shape() : shapeOf(t.it);
    if (!shape) return;
    const sp = spriteFor(t.it ? 'i:' + t.it.id : 'plate', t.w, t.h, shape);
    const url = URL.createObjectURL(await new Promise(r => sp.canvas.toBlob(r)));
    const im = new Image();
    im.className = 'shade'; im.alt = ''; im.decoding = 'async'; im.src = url;
    im.style.cssText = `left:${t.cx - sp.w / 2}px;top:${t.cy - sp.h / 2 + offset}px;width:${sp.w}px;height:${sp.h}px;opacity:0` +
      (t.rot ? `;transform:rotate(${t.rot}deg)` : '');
    // the shadow comes once its item has finished arriving (hangIn / plateIn), with a short opacity
    // transition – not an animation: one that ends with fill-mode both/forwards stays a composited layer
    // of its own (23 of them were in the trace of every panned frame); the transition is removed after
    const show = () => {
      if (t.before?.parentElement !== t.parent) return;
      t.parent.insertBefore(im, t.before);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        im.style.transition = 'opacity .45s ease'; im.style.opacity = opacity;
        im.addEventListener('transitionend', () => { im.style.transition = ''; }, { once: true });
      }));
    };
    arrived(t.hang).then(show);
  };
  // one at a time, so making them never competes with the first paint
  return todo.reduce((p, t) => p.then(() => make(t)).catch(() => {}), Promise.resolve());
}
