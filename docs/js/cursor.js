// The hand candle (PLAN phase 6): the cursor becomes a candle, its flame where the pointer is – which is
// also where the light comes from. Only for a real mouse/pen with hover; touch keeps none, and the native
// cursor comes back over the viewer (body.viewer-open).
//
// Deliberately the simplest thing that can move: ONE static image, moved by transform, nothing animated,
// no filter, no pointer prediction (Martin, 2026-10-13: smooth first, effects one at a time later). The
// earlier version flickered its flame with an animation and used getPredictedEvents(); it lagged, then
// glitched. The image is a media item (data.handCandle) like any of Martin's own assets.

/**
 * src: URL of the candle image; w×h: its size on screen in CSS px; fx, fy: where the flame's centre is,
 * as fractions of the image – that point is put on the pointer.
 */
export function handCandle({ src, w, h, fx, fy, cursor }) {
  if (!src || !matchMedia("(hover: hover) and (pointer: fine)").matches) return null;
  // Best: the candle IS the system cursor (made at build time, ≤ 128 px). The OS draws it, so it sits
  // exactly on the mouse; an image moved on pointermove is always a frame or two behind it, which is
  // the "the mouse drags behind" lag Martin saw (2026-10-25). The image below is the fallback.
  if (cursor) {
    const abs = u => new URL(u, document.baseURI).href;
    const hx = Math.round(fx * cursor.w), hy = Math.round(fy * cursor.h);
    const st = document.createElement("style");
    // url() first as the fallback, image-set() for a sharp 2× cursor where it is understood
    st.textContent = `html body.candle-native:not(.viewer-open),html body.candle-native:not(.viewer-open) *{`
      + `cursor:url("${abs(cursor.x1)}") ${hx} ${hy},auto!important;`
      + `cursor:image-set(url("${abs(cursor.x1)}") 1x,url("${abs(cursor.x2)}") 2x) ${hx} ${hy},auto!important;`
      + `cursor:-webkit-image-set(url("${abs(cursor.x1)}") 1x,url("${abs(cursor.x2)}") 2x) ${hx} ${hy},auto!important}`;
    // order matters: the last declaration a browser understands wins; Chrome and Safari take one of the
    // image-set lines, a browser that knows neither keeps the plain url()
    document.head.appendChild(st);
    document.body.classList.add("candle-native");
    return null;
  }
  const el = new Image(w, h);
  el.className = "hand-candle"; el.alt = ""; el.decoding = "async"; el.draggable = false; el.hidden = true;
  el.src = src;
  document.body.appendChild(el);
  document.body.classList.add("candle-cursor");
  const ox = fx * w, oy = fy * h;
  addEventListener("pointermove", e => {
    if (e.pointerType === "touch") return;
    if (el.hidden) el.hidden = false;
    el.style.transform = `translate3d(${e.clientX - ox}px,${e.clientY - oy}px,0)`;
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { el.hidden = true; });
  return el;
}

/** The candle as configured in data (null when none is set), resolved against the page's base URL. */
export function candleFromData(data, mediaUrl) {
  const c = data.handCandle, m = c?.media && data.media?.[c.media];
  if (!m) return null;
  const h = c.height || 118, w = Math.round(h * m.w / m.h);
  return { src: mediaUrl(c.media, m, m.widths[m.widths.length - 1]), w, h, fx: c.fx ?? 0.5, fy: c.fy ?? 0.15, cursor: c.cursor || null };
}
