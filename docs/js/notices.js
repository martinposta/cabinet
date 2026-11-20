// The notices board, opened (phase 8a): the same slate close up over a dark veil, the notices as a chalk
// timeline – date, text, a squiggle – newest first. Shared by the wall (wallpage.js) and the doors page
// (doors.js), which hands the notices in from its own HTML (no data.json fetch there, D14).

// every line written in the admin is its own paragraph (as in the exhibit viewer)
const paragraphs = t => String(t || "").split(/\n+/).map(p => p.trim()).filter(Boolean);
const dateText = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

let el = null, lastFocus = null, onClosed = null;
// the text area when the board's picture has none drawn yet: inside a typical frame
const AREA = { x: 0.12, y: 0.11, w: 0.76, h: 0.78 };

function build() {
  el = document.createElement("div");
  el.className = "notices"; el.hidden = true;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Notices");
  el.innerHTML = `<button class="close notices-close" type="button" aria-label="Close">×</button>
    <div class="nboard"><img class="nimg" alt="" hidden><div class="nslate"><div class="nlist" tabindex="0"></div></div></div>`;
  document.body.appendChild(el);
  const close = () => closeNotices();
  el.querySelector(".notices-close").addEventListener("click", close);
  el.addEventListener("click", e => { if (e.target === el) close(); });
  addEventListener("keydown", e => { if (!el.hidden && e.key === "Escape") { e.stopPropagation(); close(); } }, true);
}

/**
 * notices: [{ date: 'YYYY-MM-DD', text }], newest first (publicNotices in lib/build.mjs).
 * onClose: called once the board is closed again (the wall unfreezes its camera).
 * look: the board's own picture close up – { src, ar (w/h), area {x,y,w,h} fractions for the text } –
 * or null for the CSS board (walnut frame, slate gradient).
 */
export function openNotices(notices = [], { onClose, look = null } = {}) {
  onClosed = onClose || null;
  if (!el) build();
  const board = el.querySelector(".nboard"), img = el.querySelector(".nimg"), slate = el.querySelector(".nslate");
  board.classList.toggle("has-img", !!look);
  img.hidden = !look;
  if (look) {
    if (img.getAttribute("src") !== look.src) img.src = look.src;
    const a = look.area || AREA;
    board.style.setProperty("--ar", look.ar);
    slate.style.cssText = `left:${a.x * 100}%;top:${a.y * 100}%;width:${a.w * 100}%;height:${a.h * 100}%`;
  } else { board.style.removeProperty("--ar"); slate.style.cssText = ""; }
  const list = el.querySelector(".nlist");
  list.replaceChildren();
  if (!notices.length) list.innerHTML = `<p class="nempty">Nothing new yet.</p>`;
  notices.forEach((n, i) => {
    if (i) list.insertAdjacentHTML("beforeend", `<div class="nsquiggle" aria-hidden="true"></div>`);
    const art = document.createElement("article");
    art.className = "nentry";
    const t = document.createElement("time"); t.dateTime = n.date; t.textContent = dateText(n.date);
    art.appendChild(t);
    for (const p of paragraphs(n.text)) art.appendChild(Object.assign(document.createElement("p"), { textContent: p }));
    list.appendChild(art);
  });
  lastFocus = document.activeElement;
  el.hidden = false;
  document.body.classList.add("notices-open");
  list.scrollTop = 0;
  el.querySelector(".notices-close").focus({ preventScroll: true });
}

export function closeNotices() {
  if (!el || el.hidden) return;
  el.hidden = true;
  document.body.classList.remove("notices-open");
  if (lastFocus?.focus) lastFocus.focus({ preventScroll: true });
  const f = onClosed; onClosed = null; f?.();
}
