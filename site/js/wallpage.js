// The wall page on a desktop or a tablet: build the wall, start the camera, wire exhibits to the viewer.
// (main.js decides; on a phone mobile.js shows the exhibits as a list instead.)

import { buildWall } from './wall.js';
import { mediaUrl } from './media.js';
import { startCamera } from './camera.js';
import { exhibitRouter } from './routing.js';
import { createShadows, addStaticShadows } from './shadows.js';
import { handCandle, candleFromData } from './cursor.js';

export async function startWallPage(data) {
  // the painted damask and the frame ornaments are only needed without a wallpaper photo or with stand-ins
  if (!data.wall?.wallpaper || data.items.some(i => i.placeholder)) (await import('./placeholders.js')).decorSvgs();
  // a photographed wallpaper tile replaces the painted damask once it has loaded (PLAN phase 2)
  const tileId = data.wall?.wallpaper, tile = tileId && data.media?.[tileId];
  if (tile) {
    const im = new Image();
    im.onload = () => { window.__wallTile = im; window.__wallTileScale = (data.wall.tileWorld || 280) / im.naturalWidth; window.__wallDirty = true; };
    im.src = mediaUrl(tileId, tile, tile.widths[tile.widths.length - 1]);
  }
  const world = document.getElementById("world");
  const wall = buildWall(world, data);
  Promise.race([document.fonts.ready, new Promise(res => setTimeout(res, 1800))]).then(wall.paintAll);

  const ui = { viewerOpen: false };
  // light and shadow (phase 6): cast shadows from the hand candle and the room candles, lips inside frames
  // Every effect has its own switch (admin → Nastavení), so each one can be judged on its own; `?fx=none` or
  // `?fx=cast,lips` in the address overrides them for a quick comparison without saving anything.
  const fx = { ...data.settings.fx };
  const fxParam = new URLSearchParams(location.search).get("fx");
  if (fxParam !== null) {
    const on = new Set(fxParam.split(","));
    for (const [k, short] of [["darkness", "dark"], ["castShadows", "cast"], ["frameLips", "lips"], ["roomCandleShadows", "room"], ["handCandle", "candle"]]) fx[k] = on.has(short) || on.has(k);
  }
  // the lips are painted into the darkness canvas, so without darkness there are none
  if (fx.darkness === false) { fx.frameLips = false; document.body.classList.add("no-dark"); }
  const shadowCanvas = document.querySelector(".shadows");
  const shadows = (fx.castShadows || fx.frameLips)
    ? createShadows({ canvas: shadowCanvas, wall, roomCandles: fx.castShadows && fx.roomCandleShadows }) : null;
  if (fx.castShadows) document.body.classList.add("cast"); else shadowCanvas.hidden = true;
  if (fx.handCandle) handCandle(candleFromData(data, mediaUrl) || {});
  // soft shadows under everything, as images (never CSS filters – those stuttered the panning), then
  // every wall image decoded in the background, so panning never waits for a decode
  addStaticShadows({ wall, world }).then(() => {
    const imgs = [...world.querySelectorAll("img")];
    return imgs.reduce((p, im) => p.then(() => im.decode().catch(() => {})), Promise.resolve());
  });
  const camera = startCamera({ world, ...wall, ui, dark: fx.darkness !== false, hooks: {
    ...(fx.castShadows ? { shadows: shadows.draw } : {}),
    ...(fx.frameLips ? { dark: shadows.lips } : {}),
  } });
  // ?perf exposes the per-frame work for measuring it in the console (nothing else reads it)
  if (new URLSearchParams(location.search).has("perf")) window.__kabinet = { shadows, camera };
  const router = exhibitRouter({ data, ui, exhibits: wall.exhibits, onClose: () => camera.invalidate() });
  const openExhibit = router.open;

  // hung items carry world x/y; objects on the cabinet and in drawers carry wx/wy (their x is local)
  const worldPos = it => [it.wx ?? it.x, it.wy ?? it.y];
  wall.exhibits.forEach(it => {
    it.el.addEventListener("click", e => { e.stopPropagation(); openExhibit(it, true); });
    it.el.addEventListener("pointerenter", () => router.prefetch(it));
    it.el.addEventListener("focus", () => router.prefetch(it));
    it.el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openExhibit(it, true); } });
    it.el.addEventListener("focus", () => { if (!it.el.matches(":focus-visible")) return; camera.focusOn(...worldPos(it)); });
  });

  // an exhibit page (e/<slug>/) opens straight into its exhibit, the wall behind it already in place
  const start = router.start;
  if (start) { camera.focusOn(...worldPos(start)); openExhibit(start, false); }
}
