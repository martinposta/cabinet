# CLAUDE.md

**Cabinet of Curiosities**: Martin Pošta's projects portfolio as a night visit to a cabinet of curiosities. Static site on GitHub Pages (`docs/` on `main`, target cabinet.martinposta.com), content edited in a **local admin** that writes into the repo. Built exactly like the photo gallery (`~/Desktop/Martin/Fotogalerie`): read its `CLAUDE.md` and reuse its code and conventions.

- **Plan, decisions D1–D14, phases, log:** `PLAN.md`. Read it first, update it after every task.
- **Nothing is published until Martin explicitly says so (D7).** No GitHub remote, no push, no Pages before that.
- Talk to Martin in **Czech**. Code, comments, commits and the **public site** are in **English**; the **admin** is Czech.
- macOS (zsh). Launcher `Kabinet.command` must stay LF and executable.
- Minimal dependencies, no framework, no bundler, no CDN at runtime, fonts self-hosted. **Ask before adding any npm dependency** (only `sharp` so far, expected by the plan).
- Run `npm test` after every change.

## Commands

```bash
npm install
npm run admin      # http://localhost:4322, preview at /preview/ (NO_OPEN=1 skips the browser); runs under node --watch
npm run rebuild    # regenerate docs/ from data/cabinet.json + site/
npm run check-release  # read-only: is the site ready to go public? content + audit of the public repo (exit 1 on errors)
npm test           # node:test end-to-end, temp data root (KABINET_DATA_ROOT), port 4399
```

**Two site layouts, one entry** (2026-11-19). `site/js/main.js` loads `data.json` and picks: the wall
(`wallpage.js`) or, on a phone (≤ 760 px wide, ≤ 500 px tall with a coarse pointer, or `?mobile`), the
exhibit list (`mobile.js`). Exhibit URLs and the viewer go through `routing.js` for both – change routing
there, not in a page. Anything new on the wall must decide whether the phone list shows it.

**Overlay and wallpaper rules (perf, 2026-10-25).** Anything in the editor's `#overlay` moves by
`transform` (`place()`), never left/top, and nothing there may carry a screen-sized box-shadow – a moving
full-screen shadow repainted the whole screen every frame. The wallpaper is scaled during a zoom and
re-rastered after it settles; do not set `background-size` per frame. The hand candle is a system cursor
(`cursorFiles`, ≤ 128 px); a DOM image following the mouse always trails it.

**Martin's admin on 4322 is his – never stop it** (no `pkill -f admin/server.mjs`: it took his window down
every time and he had to start it again). `npm run admin` runs under `node --watch`, so it restarts by
itself after any change to `admin/server.mjs` or `lib/*.mjs`, and `npm run rebuild` refreshes `docs/` that
it serves; the browser opens only on the first start of a watch session. For testing start your own copy on
another port with temp data (`KABINET_DATA_ROOT=<scratchpad copy> PORT=4334 NO_OPEN=1 node admin/server.mjs`)
and stop exactly that process by its PID (`lsof -ti tcp:4334`).


## Architecture

```
admin/server.mjs   node:http, 127.0.0.1 only, Host allow-list, Origin check on non-GET
admin/public/      the admin (Czech), one page since phase 3b: index.html (shell), admin.css (its own dark theme,
                   IBM Plex self-hosted in fonts/), js/core.js (working copy, api, save + rev, undo, bus, media
                   picker), js/app.js (hash router #stena|#exponaty|#knihovna|#mistnost/<arg>, top bar, global
                   file drop), js/stena.js, js/exponaty.js, js/knihovna.js, js/mistnost.js – one per section
lib/config.mjs     paths (ROOT_DIR code, DATA_ROOT data+docs), admin port
lib/store.mjs      load/save data/cabinet.json (atomic, serialized), reloadData() after git rewrote it
lib/release-check.mjs  `npm run check-release`: content findings + audit of what the public repo would carry
lib/changes.mjs    diffCabinet(): the publish dialog's „what changes“ (exhibits/wall/media/settings), by meaning not by file
admin/git.mjs      status, fetch/sync, publish (audit → commit → rebase → push, no force); inert without origin (D7)
lib/build.mjs      data/cabinet.json + site/ → docs/ (sources normalised to LF); docs/media/ is kept, unused media pruned
lib/images.mjs     sharp pipeline: orient → reduce to the kind's max → look → WebP widths in docs/media/<id>/
lib/look.mjs       look presets (data/looks.json, knobs on raw pixels) + .cube 3D LUT parser/applier, no dependency
lib/cabinet.mjs    every mutation (media, roles, wall, cabinet, items); UserError = 400 with a Czech message
site/              public site SOURCE: templates wall.html, doors.html, list.html, 404.html ({{ROOT}} {{V}} {{TITLE}} {{META}} {{ANALYTICS}} …, never copied as such), css/, js/ modules, favicon.svg
  js/main.js         loads data.json, wires everything
  js/wall.js         builds the wall from data: frames, shelves, nameplate, cabinet + drawers, candle halos, bounds/CUT_Y
  js/camera.js       wallpaper canvas, pan/zoom, darkness + candlelight, keyboard
  js/viewer.js       exhibit viewer
  js/placeholders.js canvas-painted stand-ins (pictures, objects, wallpaper tile) for items without media
  js/media.js        <img> with srcset for a media item
  js/doors.js        the entrance page: creak, image swap, go to cabinet/; its own small candlelight
  js/shadows.js      phase 6: cast shadows (half-res canvas under #world), room-candle shadows (D12), frame lips
  js/cursor.js       phase 6: the hand candle that replaces the cursor (wall and doors)
  fonts/             self-hosted IM Fell English (+SC) and Spectral, OFL; credits in CREDITS.md
docs/              GENERATED, committed. Never edit by hand
data/cabinet.json  source of truth, 2-space JSON (model: PLAN.md section 3)
assets-inbox/      Martin's originals, git-ignored; _imported/<id>.<ext> = copy of every import (re-applying a look), looks/*.cube
PODKLADY.md        Czech asset spec for Martin (sizes, formats, minimums) – keep it in sync with KINDS in config.mjs
prototype/         the original single-file prototype, reference only
```

**The layout is data** (PLAN D4, phase 1): the prototype's spiral ran once and its result is frozen in `data/cabinet.json`; there is no layout algorithm in the code. An item is `{id, x, y, rotation, placeholder|media, exhibit?}` with `x/y` the world centre of its hang box; `on:"cabinet"` stands it on the cabinet top, `drawer:<n>, dx, dy` (0..1 of the tray) puts it in a drawer. `placeholder` = `{paint:"art"|"object", name, seed, w, h, frame?}` names a painter in `placeholders.js`; the seed keeps it identical on every load. The nameplate is `data.nameplate`; the centre piece (opening shot) is the first hung item. `wall.js` turns data items into the runtime objects the drawing code expects (`runtimeItem`) so the prototype's DOM code stayed verbatim.

**Media (phase 2).** `KINDS` in `config.mjs` decides widths and the size cap per kind (item, gallery, tile, grime, cabinet, drawer, tray); the cap is applied *before* the look, so a look always runs at the final resolution. Media ids are the sha1 of the original (12 hex), a re-import is a duplicate. Re-applying a look re-renders from `assets-inbox/_imported/` and bumps `v` – every image URL carries `?v=` because file names never change. Alpha is kept only if some pixel is not opaque. Renders go to `.media-tmp/<id>` and are renamed into `docs/media/` on success; ids being imported sit in `pendingMedia` so a concurrent debounced build does not prune them (that race happened in the tests). An item with `media` has `w` = world width (height from aspect); `media.light {x,y,radius}` (fractions of the image, radius in world px, 340 = prototype candle) makes it a light source wherever it hangs. A photographed cabinet = `cabinet.body` + `cabinet.drawers[{front,x,y,w,h}]` in world px from the cabinet's top-left + `cabinet.tray`; the top edge of the body photo is the top board. `CUT_Y` = `cabinet.cutY` (from the cabinet top) or the lowest drawer's bottom − 26, for the painted and the photographed cabinet alike. Grime is one `<img>` with alpha stretched over the wall bounds (no blend modes). A photographed wallpaper tile sets `window.__wallTileScale` = `tileWorld / width`.
A drawer item in a drawer that no longer exists is skipped, not an error (the cabinet may be re-photographed with fewer drawers).

**The admin is one page with four sections** (phase 3b, Martin's rule: every task has exactly one place): **Stěna** – the wall editor below plus layers, tools and a tabbed inspector (place / look / exhibit on-off); **Exponáty** – all exhibit texts, tags, gallery (drag to reorder, first = cover), share preview; **Knihovna** – every file, its use, look, light, replace (`POST /api/media/:id/replace` keeps the id), delete when unused, and the import sheet that opens when files are dropped anywhere (in Exponáty they go straight into the open gallery); **Místnost** – wallpaper/grime, the cabinet with drawers drawn and moved on the body photo and the page end (`cutY`) as a draggable line, doors, nameplate texts, site settings, effects, analytics. `/editor` redirects to `/#stena`; the server also serves `/media/*` because the site's modules build relative `media/…` URLs and the admin page sits at `/` (no `<base>`: it would turn the `#section` links into `/preview/#…`).
The site's `cabinet.css` is loaded for the wall and shares two class names with the admin (`.btn`, `.card`): `admin.css` resets everything those set, and its element reset uses `:where()` so any admin class wins over it. Texts edited in Exponáty use `commit(…, {undoable:false})`, and wall undo restores a snapshot **without** touching exhibit content (`restore()` in core.js keeps the current texts) – ⌘Z on the wall never undoes a description. A section that is hidden sets the camera's `ui.viewerOpen`, so wheel and keys there never move the hidden wall.
**The wall editor** (section Stěna, phase 3) renders the wall with the public site's own modules (`/preview/js/*`, hence `<base href="/preview/">` – the site builds relative `media/…` URLs) from an in-memory copy of the data, with the camera's `dark:false` and bounds widened by 700 px (`camera.setWall`). Every change mutates that copy, rebuilds the whole wall (placeholder paint is cached in `wall.js`, so a rebuild is instant) and saves everything with **`PUT /api/layout`** (`replaceLayout`), which rebuilds each item through the same validation as a single PATCH and changes nothing if any item fails. Undo/redo are snapshots of `{items, nameplate}`; changes with the same label within 700 ms (nudges, typing) merge into one step. Elements carry `data-id` (hung: the `.hang`; on the cabinet / in a drawer: the `<img>`; the nameplate: `__nameplate`). Traps met while building it: **anything the editor puts over the wall must stop `pointerdown`/`wheel` propagation** – the camera listens on `<body>`/`window`, a drag that reaches it pans the wall and its capture-phase click guard then swallows the next click (the opening dialog's Save did nothing until the dialog stopped propagation too); the editor's keydown runs in the **capture phase on window** and calls `stopImmediatePropagation`, or the camera would pan on the arrows meant for nudging; and the drop position of a library drag is taken from the last `dragover` (the embedded test browser reported the drop at the drag's start). Snapping: an item's bottom snaps (12 screen px) onto the top of a hung item or the cabinet board under its centre; snapping onto the board makes it `on:"cabinet"`, lifting it off makes it hang. Alt disables snapping. Resizing keeps the top-left corner (on the cabinet: the bottom-left).
**Where the page opens** is `data.view` (`{x,y}` world point, `null` = above the middle of the cabinet); `openingView()` in `camera.js` turns it into the opening shot (zoom from the nameplate + centre piece, clamped by the margins and the page end) for the site and for the admin's „Výchozí pohled“ frame alike – change the opening logic only there.
`exhibit.gallery` is ordered, the first photo is the cover; `exhibit.captions` maps media id → caption; `exhibit.plaque:false` hides the brass label. `item.plaqueAt {dx,dy}` (world px, ±1500) moves that label off its default place (lower right corner of the exhibit); it is relative to the exhibit, drawn through `--pq-dx/--pq-dy` (`makePlaque` in `wall.js`) and dragged in the editor (double click resets). The plaque's size is `plates.plaque.size`, not a per-item value. `item.opening {shape: rect|oval, x,y,w,h}` (fractions of the image) is stored for phase 6 and not rendered yet.

**Pages (phase 4/4b).** Every URL is a real file: `/` = the doors (`doors.html`, no wall code, only `prefetch` of `cabinet/` and `data.json`), `cabinet/` = the wall, `e/<slug>/` = the wall with `data-exhibit` set, opening that exhibit (no doors on deep links), `list/` = plain list for search engines and screen readers (linked from the wall's `<noscript>` and from the doors). Opening an exhibit `pushState`s `e/<slug>/`, closing pushes `cabinet/`, `popstate` opens/closes the viewer. `<base href="{{ROOT}}">` makes every page's relative URLs and `fetch`es resolve from the site root. `404.html` is served by Pages at any depth, so it links **absolutely** to `settings.siteUrl` (or `/`). Canonical, `og:url`, `og:image` and `sitemap.xml` exist only when `siteUrl` is set (default `https://cabinet.martinposta.com/`). `og:image` = the exhibit's cover (first gallery photo, else the item's own cut-out flattened on the wall green), site-wide = the closed doors photo. Kinds with `og:true` write `og.jpg`; `ogOf()` checks the file exists, because media imported before a kind got `og` have none. Sounds (`kind:"sound"`, the creak) are published as uploaded (`docs/media/<id>/sound.<ext>`), no conversion and no dependency. Exhibit slugs are URLs: changing one breaks shared links (no redirects yet – Fotogalerie D21 is the pattern if that is ever needed).
**Light and shadow (phase 6).** Silhouette sprites are made **in the browser** from each item's loaded image or its placeholder shape (one blurred canvas ≤ 192 px per item, once), not at import as the plan first said: the same code then covers placeholders and needs no pipeline change. Per frame `shadows.draw` puts every visible sprite on the `.shadows` canvas (half res, between `#wall` and `#world`), pushed away from the hand candle (`len = clamp(d·0.11, 8, 90)` screen px, fading out by 1000 px) – and only when the view or the candle moved (`state.changed`) or a visible item had no sprite yet. Room candles (`wall.candleFlames`) add static shadows computed once; where they light an item the hand shadow is weakened by `1 − 0.75·roomLight`. `settings.roomCandleShadows` switches them off (D12, admin → Nastavení). Lips (`shadows.lips`, camera hook `dark`) paint into the darkness canvas, clipped to `item.opening` – or, for placeholder frames, to the liner computed from `fw` – a band on the edge facing the flame. **A shadow must not arrive before its item**: hung items fade in one by one (hangIn, `--i` × 75 ms), so each caster waits for its own animation delay; without that the first second showed dark rectangles with no pictures. With cast shadows on (`body.cast`) the baked "light from above" box/drop shadows shrink to contact shadows, or every picture would carry two shadows pointing different ways. The lip fades with the flame's **sideways** distance from the opening's centre (`side`): a flame right in front lights the picture straight on, and without the fade the band spun round as the cursor crossed the middle. The cast shadow likewise shrinks to nothing under the flame (no minimum offset). **The hand candle must never cost a repaint**: its body is a static SVG moved by `transform`, the flame is a separate element whose flicker animates `transform` (compositor). The first version animated a `<g>` inside the SVG and carried `filter: drop-shadow` – a CSS animation inside SVG is not composited, so the whole candle and its filter repainted every frame and the candle visibly trailed the pointer (Martin: "the mouse drags behind the touchpad"). It also uses `getPredictedEvents()` where the browser has it. A page-drawn cursor stays about a frame behind the system one whatever we do. The hand candle (`cursor.js`) exists only for `(hover:hover) and (pointer:fine)`; `body.viewer-open` brings the native cursor back over the viewer. `?perf` exposes `window.__kabinet = {shadows, camera}` for measuring.

**The viewer shows a photo only once it is decoded** (`load()` in `viewer.js`: `img.decode()`, then the cross-fade; cover first, neighbours next; `prefetch` on hover/focus of an exhibit). No `backdrop-filter` on the overlay – it is a full-screen filter like any other.
**No CSS `filter` on anything inside `#world`** (2026-10-13): a blurred drop-shadow is re-rasterised for every tile that pans into view, and with ~25 large images it made panning stutter even with every effect off. Shadows under things are images (`addStaticShadows` in `shadows.js`); the prototype's rule "no filter on full-screen layers" turned out to apply to the wall's contents too. Wall images are decoded in the background right after load (`img.decode()`, one at a time).
**Every effect is switchable** (`settings.fx`: darkness (the candlelight darkness + glow; lips need it), castShadows, frameLips, roomCandleShadows, handCandle; `effects()` in `build.mjs` supplies defaults and reads the old `roomCandleShadows`), and `?fx=` in the address overrides them without saving. New effects get a switch too – Martin's rule: smooth first, effects added one at a time. **Layout saves carry `rev`** (`layoutRev()`, a hash of items + nameplate); `replaceLayout` refuses an outdated one with 409. Never leave an editor tab open on one data root while the admin is restarted on another: it would hold the wrong data in memory (this is how 6 items most likely vanished on 2026-10-13, before `rev` existed).
**There are no stand-ins left in the data**: every item is media (rasterised 2026-10-13). `placeholders.js` still paints for items with a `placeholder`, so old data keeps rendering, but nothing uses it now.

**Commit identity** (as Fotogalerie D23): the repo has local `user.name "Martin Porter"` and the GitHub noreply e-mail. The repo will be public; never commit with the personal address.

Invariants carried over from Fotogalerie: originals never in the repo; no metadata, never GPS in published images (never `keepMetadata`/`withMetadata`); `docs/` is generated; all public URLs relative to `{{ROOT}}`; admin local-only; don't set `GIT_TERMINAL_PROMPT=0`; the build must not depend on line endings.

## Rules from the prototype that must not break

Performance
- No `mix-blend-mode`, no `filter` on full-screen layers, no per-frame CSS shadow changes. No WebGL, no normal maps (D11).
- Wallpaper = one element with the tile as a repeating background, a tile larger than the screen on every side, moved by `transform` only (2026-10-13; it was a full-screen `<canvas>` refilled with a pattern every frame, and a trace of a pan showed the GPU dropping frames). Only a zoom change re-rasterises it.
- **No animation with `fill-mode: both/forwards` on anything that stays on the wall**: a finished animation that keeps its end value keeps the element a composited layer of its own (a pan trace showed 28 layers per frame, 23 of them the shadows). `backwards` is fine.
- `#world`: `will-change: transform`, moves only via `translate3d() scale()`.
- Darkness = quarter-resolution canvas, lights cut with `destination-out`.
- Wall images are static `<img>`. The camera stops when it reaches its target.

Interaction
- Pan by **dragging**, never by following the cursor. Click vs drag threshold 6 px; a drag ending over an item does not open it (capture-phase click handler).
- No camera animation: instant pan/zoom, no inertia. Wheel zoom towards the cursor, pinch on touch.
- Zoom max 1.25, min `0.7 * min(1, vw/1566)`. Side margins 26 % of window width, max 440 px.
- The cabinet is the bottom edge: camera never below `CUT_Y`. No HUD. Keys: arrows, +/−, 0, Enter on a focused exhibit.

Look
- Night room, black screen edges, flickering candlelight at the cursor (off with `prefers-reduced-motion`), room candles light themselves.
- Nameplate above the centre piece with clear space around it.
- Drawer opens: front slides down, reveals a velvet tray with objects.
