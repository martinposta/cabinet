// Entrance (PLAN D14). Click (or Enter/Space – it is a <button>): play the creak inside the click,
// swap the closed doors for the ajar photo (one image swap, no transition), then go to the wall when
// the sound ends – capped, and at once if audio fails or reduced motion is asked for.
// Candlelight: one quarter-resolution darkness canvas with the hand candle cut out, as on the wall.
import { handCandle } from './cursor.js';

handCandle(window.DOORS?.candle || {});
{
  const cfg = window.DOORS || {};
  const btn = document.getElementById("doors");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CAP = 1400;
  const target = new URL("cabinet/", document.baseURI).href;

  // the ajar picture is preloaded (small), the creak only fetched
  if (cfg.ajar) { const im = new Image(); im.src = cfg.ajar; }
  const audio = cfg.sound ? new Audio(cfg.sound) : null;
  if (audio) audio.preload = "auto";

  let leaving = false;
  btn.addEventListener("click", () => {
    if (leaving) return;
    leaving = true;
    const go = () => location.assign(target);
    if (reduce) return go();
    const img = btn.querySelector("img");
    if (cfg.ajar && img) { img.srcset = ""; img.src = cfg.ajar; }
    else if (!cfg.ajar) btn.classList.add("ajar");
    if (!audio) return setTimeout(go, 350);
    const t = setTimeout(go, CAP);
    audio.addEventListener("ended", () => { clearTimeout(t); go(); }, { once: true });
    audio.play().catch(() => { clearTimeout(t); go(); });
  });

  // ---- candlelight (pointer devices only; on touch the canvas is hidden by CSS) ----
  const cv = document.querySelector(".dark");
  const fxParam = new URLSearchParams(location.search).get("fx");
  const darkOn = fxParam !== null ? fxParam.split(",").some(f => f === "dark" || f === "darkness") : cfg.dark !== false;
  if (cv && !darkOn) cv.hidden = true;
  else if (cv && !matchMedia("(hover: none)").matches) candlelight(cv);
}

function candlelight(cv) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = cv.getContext("2d"), RES = 4;
  const STOPS = [[0, 1], [140, 1], [280, .72], [470, .38], [700, .14], [980, .04], [1300, 0]];
  let x = innerWidth / 2, y = innerHeight * .45, f = 1, to = 1, wait = 0, last = performance.now(), dirty = true;
  const size = () => { cv.width = Math.ceil(innerWidth / RES); cv.height = Math.ceil(innerHeight / RES); dirty = true; };
  size(); addEventListener("resize", size);
  addEventListener("pointermove", e => { x = e.clientX; y = e.clientY; dirty = true; });
  function frame(now) {
    const dt = Math.min(48, now - last); last = now;
    if (!reduce) { wait -= dt; if (wait <= 0) { to = 1 + (Math.random() - .5) * .07; wait = 50 + Math.random() * 130; } const n = f + (to - f) * .22; if (Math.abs(n - f) > .0004) { f = n; dirty = true; } }
    if (dirty) {
      const k = 1 / RES, R = STOPS[STOPS.length - 1][0] * f * k;
      ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "rgba(2,1,0,.93)"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = "destination-out";
      const g = ctx.createRadialGradient(x * k, y * k, 0, x * k, y * k, R);
      STOPS.forEach(([px, a]) => g.addColorStop(Math.min(1, px * f * k / R), `rgba(0,0,0,${a})`));
      ctx.fillStyle = g; ctx.fillRect(x * k - R, y * k - R, 2 * R, 2 * R);
      dirty = false;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
